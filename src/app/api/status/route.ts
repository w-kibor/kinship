import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { nanoid } from "nanoid";
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
  userId: z.string().uuid("Invalid user ID"),
  circleId: z.string().uuid("Invalid circle ID"),
  status: z.enum(["safe", "help", "unknown"]),
  note: z.string().trim().max(240).optional(),
  batteryPct: z.number().min(0).max(100).optional(),
  location: z
    .object({
      lat: z.number(),
      lng: z.number(),
      accuracy: z.number().optional(),
    })
    .nullable()
    .optional(),
});

/**
 * GET /api/status?circleId=<uuid>&userId=<uuid>
 * Fetch all recent statuses for a circle (last 48 hours)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseClient();
    const { searchParams } = new URL(request.url);
    const circleId = searchParams.get("circleId");
    const userId = searchParams.get("userId");

    if (!circleId || !userId) {
      return NextResponse.json(
        { error: "Missing circleId or userId parameter" },
        { status: 400 }
      );
    }

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

    // Get all statuses from the last 48 hours for this circle
    const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

    const { data: statuses, error: statusError } = await supabase
      .from("statuses")
      .select(
        `
        id,
        user_id,
        status,
        note,
        lat,
        lng,
        accuracy_m,
        battery_pct,
        created_at,
        profiles (
          email,
          phone
        )
        `
      )
      .eq("circle_id", circleId)
      .gte("created_at", fortyEightHoursAgo)
      .order("created_at", { ascending: false });

    if (statusError) {
      console.error("Failed to fetch statuses:", statusError);
      return NextResponse.json(
        { error: "Failed to fetch statuses" },
        { status: 500 }
      );
    }

    // Group by user and get the latest status for each
    const latestByUser = new Map<string, any>();
    statuses?.forEach((status: any) => {
      if (!latestByUser.has(status.user_id)) {
        latestByUser.set(status.user_id, status);
      }
    });

    // Format the response
    const circle = Array.from(latestByUser.values()).map((status: any) => ({
      id: status.user_id,
      name: status.profiles?.email?.split("@")[0] || "Unknown",
      email: status.profiles?.email,
      status: status.status,
      updatedAt: status.created_at,
      note: status.note,
      location: status.lat && status.lng
        ? {
            lat: status.lat,
            lng: status.lng,
            accuracy: status.accuracy_m,
          }
        : null,
      batteryPct: status.battery_pct,
      isYou: status.user_id === userId,
    }));

    return NextResponse.json({ circle }, { status: 200 });
  } catch (error) {
    console.error("GET /api/status error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/status
 * Create a new status update for a user in a circle
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseClient();
    const body = await request.json().catch(() => undefined);
    const parsed = bodySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", issues: parsed.error.format() },
        { status: 400 }
      );
    }

    const { userId, circleId, status, note, batteryPct, location } = parsed.data;

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

    // Insert the new status
    const { data: newStatus, error: insertError } = await supabase
      .from("statuses")
      .insert({
        user_id: userId,
        circle_id: circleId,
        status,
        note: note || null,
        lat: location?.lat || null,
        lng: location?.lng || null,
        accuracy_m: location?.accuracy || null,
        battery_pct: batteryPct || null,
      })
      .select("id, created_at")
      .single();

    if (insertError || !newStatus) {
      console.error("Failed to insert status:", insertError);
      return NextResponse.json(
        { error: "Failed to save status" },
        { status: 500 }
      );
    }

    const ack = {
      ackId: nanoid(),
      receivedAt: newStatus.created_at,
      queued: false,
      statusId: newStatus.id,
      entry: {
        id: userId,
        status,
        note,
        updatedAt: newStatus.created_at,
        location: location || null,
        batteryPct,
      },
    };

    return NextResponse.json(ack, { status: 201 });
  } catch (error) {
    console.error("POST /api/status error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
