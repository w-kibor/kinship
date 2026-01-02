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

// Schema for updating profile
const updateSchema = z.object({
  userId: z.string().uuid("Invalid user ID"),
  phone: z.string().regex(/^\+?[1-9]\d{1,14}$/, "Invalid phone number").optional(),
  email: z.string().email("Invalid email").optional(),
  publicKey: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseClient();
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { error: "Missing userId parameter" },
        { status: 400 }
      );
    }

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("id, email, phone, public_key, created_at")
      .eq("id", userId)
      .single();

    if (error || !profile) {
      return NextResponse.json(
        { error: "Profile not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        id: profile.id,
        email: profile.email,
        phone: profile.phone,
        publicKey: profile.public_key,
        createdAt: profile.created_at,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("GET /api/profile error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = getSupabaseClient();
    const body = await request.json();
    const parsed = updateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid data", issues: parsed.error.format() },
        { status: 400 }
      );
    }

    const { userId, phone, email, publicKey } = parsed.data;

    // Build update object with only provided fields
    const updateData: Record<string, string | null> = {};
    if (phone !== undefined) updateData.phone = phone;
    if (email !== undefined) updateData.email = email;
    if (publicKey !== undefined) updateData.public_key = publicKey;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 }
      );
    }

    const { data: updated, error } = await supabase
      .from("profiles")
      .update(updateData)
      .eq("id", userId)
      .select("id, email, phone, public_key, created_at")
      .single();

    if (error || !updated) {
      console.error("Profile update failed:", error);
      return NextResponse.json(
        { error: "Failed to update profile" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        id: updated.id,
        email: updated.email,
        phone: updated.phone,
        publicKey: updated.public_key,
        createdAt: updated.created_at,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("PATCH /api/profile error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
