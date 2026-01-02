import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { nanoid } from "nanoid";

function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return null;
  }

  try {
    return createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  } catch (error) {
    console.error("Failed to create Supabase client:", error);
    return null;
  }
}

const bodySchema = z.object({
  email: z.string().email("Invalid email address"),
});

// In-memory store for development
const devMagicLinks = new Map<string, { userId: string; expiresAt: Date }>();
const devProfiles = new Map<string, { id: string; email: string }>();

/**
 * POST /api/auth/send-link
 * Generate a magic link. Falls back to in-memory storage if Supabase unavailable.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = bodySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid email", issues: parsed.error.format() },
        { status: 400 }
      );
    }

    const { email } = parsed.data;
    const supabase = getSupabaseClient();

    let userId: string;

    if (supabase) {
      try {
        const { data: existingProfile, error: lookupError } = await supabase
          .from("profiles")
          .select("id")
          .eq("email", email)
          .single();

        if (lookupError && lookupError.code !== "PGRST116") {
          throw lookupError;
        }

        if (existingProfile) {
          userId = existingProfile.id;
        } else {
          const { data: newUser, error: insertError } = await supabase
            .from("profiles")
            .insert({ email })
            .select("id")
            .single();

          if (insertError || !newUser) {
            throw insertError || new Error("Failed to create profile");
          }

          userId = newUser.id;
        }
      } catch (error: any) {
        console.warn("Supabase unavailable, using dev storage:", error.message);
        userId = devProfiles.get(email)?.id || nanoid();
        devProfiles.set(email, { id: userId, email });
      }
    } else {
      userId = devProfiles.get(email)?.id || nanoid();
      devProfiles.set(email, { id: userId, email });
    }

    const token = nanoid(32);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    if (supabase) {
      try {
        const { error: linkError } = await supabase.from("magic_links").insert({
          user_id: userId,
          token,
          expires_at: expiresAt.toISOString(),
        });

        if (linkError) throw linkError;
      } catch (error: any) {
        console.warn("Using dev storage for magic link:", error.message);
        devMagicLinks.set(token, { userId, expiresAt });
      }
    } else {
      devMagicLinks.set(token, { userId, expiresAt });
    }

    return NextResponse.json(
      {
        success: true,
        message: "Magic link created",
        userId,
        token,
        expiresAt: expiresAt.toISOString(),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("POST /api/auth/send-link error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Export for verify-link to access
export { devMagicLinks, devProfiles };
