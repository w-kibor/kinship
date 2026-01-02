import { NextRequest, NextResponse } from "next/server";
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

/**
 * Parse SMS body for status commands
 * Formats:
 * - SAFE <PIN>
 * - SAFE <PIN> <LAT,LNG>
 * - HELP <PIN>
 * - HELP <PIN> <LAT,LNG>
 */
function parseSMSCommand(body: string): {
  command: "safe" | "help" | null;
  pin: string | null;
  lat: number | null;
  lng: number | null;
} {
  const normalized = body.trim().toUpperCase();
  const parts = normalized.split(/\s+/);

  if (parts.length < 2) {
    return { command: null, pin: null, lat: null, lng: null };
  }

  const command = parts[0] === "SAFE" ? "safe" : parts[0] === "HELP" ? "help" : null;
  const pin = parts[1] || null;

  let lat: number | null = null;
  let lng: number | null = null;

  // Parse coordinates if provided
  if (parts.length >= 3) {
    const coords = parts[2].split(",");
    if (coords.length === 2) {
      lat = parseFloat(coords[0]);
      lng = parseFloat(coords[1]);
      if (isNaN(lat) || isNaN(lng)) {
        lat = null;
        lng = null;
      }
    }
  }

  return { command, pin, lat, lng };
}

/**
 * POST /api/webhooks/sms
 * Twilio webhook handler for incoming SMS
 * Expects Twilio's standard webhook format
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseClient();
    
    // Parse form data from Twilio
    const formData = await request.formData();
    const from = formData.get("From")?.toString() || "";
    const body = formData.get("Body")?.toString() || "";
    const messageId = formData.get("MessageSid")?.toString() || "";

    console.log("SMS webhook received:", { from, body, messageId });

    // Parse the SMS command
    const { command, pin, lat, lng } = parseSMSCommand(body);

    if (!command || !pin) {
      return new NextResponse(
        `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>Invalid format. Use: SAFE [PIN] or HELP [PIN]</Message>
</Response>`,
        {
          status: 200,
          headers: { "Content-Type": "text/xml" },
        }
      );
    }

    // Find user by PIN
    const { data: trigger, error: triggerError } = await supabase
      .from("sms_triggers")
      .select("user_id")
      .eq("pin_code", pin)
      .single();

    if (triggerError || !trigger) {
      console.error("PIN not found:", pin);
      return new NextResponse(
        `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>Invalid PIN. Please check and try again.</Message>
</Response>`,
        {
          status: 200,
          headers: { "Content-Type": "text/xml" },
        }
      );
    }

    const userId = trigger.user_id;

    // Get user's circles
    const { data: memberships, error: memberError } = await supabase
      .from("circle_members")
      .select("circle_id")
      .eq("member_id", userId);

    if (memberError || !memberships || memberships.length === 0) {
      console.error("User not in any circles:", userId);
      return new NextResponse(
        `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>You are not part of any circle.</Message>
</Response>`,
        {
          status: 200,
          headers: { "Content-Type": "text/xml" },
        }
      );
    }

    // Insert status for each circle
    const statusInserts = memberships.map((m: any) => ({
      user_id: userId,
      circle_id: m.circle_id,
      status: command,
      lat: lat,
      lng: lng,
      accuracy_m: null,
      note: `Via SMS from ${from}`,
      battery_pct: null,
    }));

    const { error: insertError } = await supabase
      .from("statuses")
      .insert(statusInserts);

    if (insertError) {
      console.error("Failed to insert statuses:", insertError);
      return new NextResponse(
        `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>Failed to update status. Please try again.</Message>
</Response>`,
        {
          status: 200,
          headers: { "Content-Type": "text/xml" },
        }
      );
    }

    const statusText = command === "safe" ? "SAFE" : "HELP";
    const locationText = lat && lng ? ` at ${lat},${lng}` : "";

    return new NextResponse(
      `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>Status updated to ${statusText}${locationText}. Your circle has been notified.</Message>
</Response>`,
      {
        status: 200,
        headers: { "Content-Type": "text/xml" },
      }
    );
  } catch (error) {
    console.error("POST /api/webhooks/sms error:", error);
    return new NextResponse(
      `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>System error. Please try again later.</Message>
</Response>`,
      {
        status: 200,
        headers: { "Content-Type": "text/xml" },
      }
    );
  }
}

/**
 * GET /api/webhooks/sms
 * Health check for webhook
 */
export async function GET() {
  return NextResponse.json(
    {
      service: "Kinship SMS Webhook",
      status: "active",
      formats: [
        "SAFE <PIN>",
        "SAFE <PIN> <LAT,LNG>",
        "HELP <PIN>",
        "HELP <PIN> <LAT,LNG>",
      ],
    },
    { status: 200 }
  );
}
