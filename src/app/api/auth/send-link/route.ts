import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { nanoid } from "nanoid";

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
  email: z.string().email("Invalid email address"),
});

export async function POST(request: NextRequest) {
  console.log("=== POST /api/auth/send-link called ===");
  try {
    console.log("1. Parsing request body...");
    const body = await request.json();
    console.log("2. Body parsed:", body);
    
    const parsed = bodySchema.safeParse(body);
    console.log("3. Schema validation result:", parsed.success);

    if (!parsed.success) {
      console.log("4. Validation failed:", parsed.error);
      return NextResponse.json(
        { error: "Invalid email", issues: parsed.error.format() },
        { status: 400 }
      );
    }

    const { email } = parsed.data;
    console.log("5. Email:", email);

    console.log("6. Creating Supabase client...");
    const supabase = getSupabaseClient();
    console.log("7. Supabase client created:", !!supabase);

    // Get or create user profile
    let userId: string;
    try {
      console.log("8. Querying for existing profile...");
      const { data: existingProfile, error: lookupError } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", email)
        .single();

      console.log("9. Query result - data:", existingProfile, "error:", lookupError);

      if (lookupError && lookupError.code !== "PGRST116") {
        // PGRST116 = no rows returned
        console.log("10. Database lookup error:", lookupError);
        throw lookupError;
      }

      if (existingProfile) {
        userId = existingProfile.id;
        console.log("11. Found existing profile:", userId);
      } else {
        console.log("12. Creating new profile...");
        const { data: newUser, error: insertError } = await supabase
          .from("profiles")
          .insert({ email })
          .select("id")
          .single();

        console.log("13. Insert result - data:", newUser, "error:", insertError);

        if (insertError || !newUser) {
          console.error("Profile creation failed:", insertError);
          return NextResponse.json(
            { error: "Failed to create profile" },
            { status: 500 }
          );
        }

        userId = newUser.id;
        console.log("14. Created new profile:", userId);
      }
    } catch (dbError: any) {
      console.error("Database error:", dbError);
      return NextResponse.json(
        { error: "Database error", details: dbError.message },
        { status: 500 }
      );
    }

    console.log("15. Generating magic link token...");
    // Generate a magic link token
    const token = nanoid(32);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    console.log("16. Storing magic link...");
    // Store the magic link
    const { error: linkError } = await supabase.from("magic_links").insert({
      user_id: userId,
      token,
      expires_at: expiresAt.toISOString(),
    });

    if (linkError) {
      console.error("Magic link creation failed:", linkError);
      return NextResponse.json(
        { error: "Failed to create magic link" },
        { status: 500 }
      );
    }

    console.log("17. Success! Returning response...");
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
