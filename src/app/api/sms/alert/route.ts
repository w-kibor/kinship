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

const alertSchema = z.object({
  userId: z.string().uuid("Invalid user ID"),
  circleId: z.string().uuid("Invalid circle ID"),
  message: z.string().min(1).max(160),
});

/**
 * POST /api/sms/alert
 * Send SMS alert to all circle members (requires Africa's Talking)
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseClient();
    const body = await request.json();
    const parsed = alertSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid data", issues: parsed.error.format() },
        { status: 400 }
      );
    }

    const { userId, circleId, message } = parsed.data;

    // Verify user is member of this circle
    const { data: membership, error: memberError } = await supabase
      .from("circle_members")
      .select("member_id")
      .eq("circle_id", circleId)
      .eq("member_id", userId)
      .single();

    if (memberError || !membership) {
      return NextResponse.json(
        { error: "Not a member of this circle" },
        { status: 403 }
      );
    }

    // Get all members with phone numbers (exclude sender)
    const { data: members, error: membersError } = await supabase
      .from("circle_members")
      .select(
        `
        member_id,
        profiles (
          phone,
          email
        )
        `
      )
      .eq("circle_id", circleId)
      .neq("member_id", userId);

    if (membersError) {
      console.error("Failed to fetch members:", membersError);
      return NextResponse.json(
        { error: "Failed to fetch members" },
        { status: 500 }
      );
    }

    const recipients = members
      ?.filter((m: any) => m.profiles?.phone)
      .map((m: any) => m.profiles.phone) || [];

    if (recipients.length === 0) {
      return NextResponse.json(
        { 
          success: true, 
          sent: 0,
          message: "No members have phone numbers configured" 
        },
        { status: 200 }
      );
    }

    // Check for Africa's Talking credentials
    const atApiKey = process.env.AFRICASTALKING_API_KEY;
    const atUsername = process.env.AFRICASTALKING_USERNAME;
    const smsNumber = process.env.KINSHIP_SMS_NUMBER;

    if (!atApiKey || !atUsername || !smsNumber) {
      console.warn("Africa's Talking not configured - SMS alerts disabled");
      return NextResponse.json(
        {
          error: "SMS service not configured",
          recipients: recipients.length,
        },
        { status: 503 }
      );
    }

    // Send SMS via Africa's Talking
    const results = await Promise.allSettled(
      recipients.map(async (phone: string) => {
        const response = await fetch(
          "https://api.africastalking.com/version1/messaging",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
              "apiKey": atApiKey,
              "Accept": "application/json",
            },
            body: new URLSearchParams({
              username: atUsername,
              to: phone,
              message: message,
              from: smsNumber,
            }).toString(),
          }
        );

        if (!response.ok) {
          throw new Error(`Failed to send to ${phone}`);
        }

        return response.json();
      })
    );

    const successful = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;

    return NextResponse.json(
      {
        success: true,
        sent: successful,
        failed,
        total: recipients.length,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("POST /api/sms/alert error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
