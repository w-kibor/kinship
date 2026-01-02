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

// Generate a 6-digit PIN
function generatePIN(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

const createPinSchema = z.object({
  userId: z.string().uuid("Invalid user ID"),
});

/**
 * GET /api/sms/pin?userId=<uuid>
 * Get the current SMS PIN for a user
 */
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

    const { data: trigger, error } = await supabase
      .from("sms_triggers")
      .select("pin_code, last_rotated_at")
      .eq("user_id", userId)
      .single();

    if (error && error.code !== "PGRST116") {
      console.error("Failed to fetch PIN:", error);
      return NextResponse.json(
        { error: "Failed to fetch PIN" },
        { status: 500 }
      );
    }

    if (!trigger) {
      return NextResponse.json(
        { error: "No PIN found. Use POST to create one." },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        pinCode: trigger.pin_code,
        lastRotatedAt: trigger.last_rotated_at,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("GET /api/sms/pin error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/sms/pin
 * Create or rotate the SMS PIN for a user
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseClient();
    const body = await request.json();
    const parsed = createPinSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid data", issues: parsed.error.format() },
        { status: 400 }
      );
    }

    const { userId } = parsed.data;
    const newPin = generatePIN();

    // Check if PIN already exists
    const { data: existing } = await supabase
      .from("sms_triggers")
      .select("user_id")
      .eq("user_id", userId)
      .single();

    if (existing) {
      // Update existing PIN
      const { error: updateError } = await supabase
        .from("sms_triggers")
        .update({
          pin_code: newPin,
          last_rotated_at: new Date().toISOString(),
        })
        .eq("user_id", userId);

      if (updateError) {
        console.error("Failed to rotate PIN:", updateError);
        return NextResponse.json(
          { error: "Failed to rotate PIN" },
          { status: 500 }
        );
      }
    } else {
      // Create new PIN
      const { error: insertError } = await supabase
        .from("sms_triggers")
        .insert({
          user_id: userId,
          pin_code: newPin,
          last_rotated_at: new Date().toISOString(),
        });

      if (insertError) {
        console.error("Failed to create PIN:", insertError);
        return NextResponse.json(
          { error: "Failed to create PIN" },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(
      {
        success: true,
        pinCode: newPin,
        message: "PIN created/rotated successfully",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("POST /api/sms/pin error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
