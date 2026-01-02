import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";

function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Missing Supabase credentials");
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

const bodySchema = z.object({
  token: z.string().min(20, "Invalid token"),
});

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseClient();
    const body = await request.json();
    const parsed = bodySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid token", issues: parsed.error.format() },
        { status: 400 }
      );
    }

    const { token } = parsed.data;

    // Look up the magic link
    const { data: magicLink, error: lookupError } = await supabase
      .from("magic_links")
      .select("id, user_id, expires_at, consumed_at")
      .eq("token", token)
      .single();

    if (lookupError || !magicLink) {
      return NextResponse.json(
        { error: "Invalid or expired token" },
        { status: 401 }
      );
    }

    // Check if token is expired
    if (new Date(magicLink.expires_at) < new Date()) {
      return NextResponse.json(
        { error: "Token has expired" },
        { status: 401 }
      );
    }

    // Check if token was already consumed
    if (magicLink.consumed_at) {
      return NextResponse.json(
        { error: "Token has already been used" },
        { status: 401 }
      );
    }

    // Mark token as consumed
    const { error: consumeError } = await supabase
      .from("magic_links")
      .update({ consumed_at: new Date().toISOString() })
      .eq("id", magicLink.id);

    if (consumeError) {
      console.error("Failed to consume magic link:", consumeError);
      return NextResponse.json(
        { error: "Failed to verify token" },
        { status: 500 }
      );
    }

    // Fetch user profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, email, phone")
      .eq("id", magicLink.user_id)
      .single();

    if (profileError || !profile) {
      console.error("Profile not found:", profileError);
      return NextResponse.json(
        { error: "User profile not found" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        userId: profile.id,
        email: profile.email,
        phone: profile.phone,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("POST /api/auth/verify-link error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
