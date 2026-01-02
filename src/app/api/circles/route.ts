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

const createCircleSchema = z.object({
  userId: z.string().uuid("Invalid user ID"),
  name: z.string().min(1, "Circle name required").max(100),
});

/**
 * GET /api/circles?userId=<uuid>
 * List all circles for a user (as owner or member)
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

    // Get circles where user is owner
    const { data: ownedCircles, error: ownError } = await supabase
      .from("circles")
      .select("id, name, owner_id, emergency_window_until, created_at")
      .eq("owner_id", userId);

    if (ownError) {
      console.error("Error fetching owned circles:", ownError);
      return NextResponse.json(
        { error: "Failed to fetch circles" },
        { status: 500 }
      );
    }

    // Get circles where user is member
    const { data: memberCircles, error: memberError } = await supabase
      .from("circle_members")
      .select(
        `
        circle_id,
        circles (
          id,
          name,
          owner_id,
          emergency_window_until,
          created_at
        )
        `
      )
      .eq("member_id", userId);

    if (memberError) {
      console.error("Error fetching member circles:", memberError);
      return NextResponse.json(
        { error: "Failed to fetch circles" },
        { status: 500 }
      );
    }

    // Combine and deduplicate
    const allCircles = [
      ...(ownedCircles || []),
      ...(memberCircles?.map((m: any) => m.circles).filter(Boolean) || []),
    ];

    const uniqueCircles = Array.from(
      new Map(allCircles.map((c: any) => [c.id, c])).values()
    );

    return NextResponse.json(
      { circles: uniqueCircles },
      { status: 200 }
    );
  } catch (error) {
    console.error("GET /api/circles error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/circles
 * Create a new circle (owner gets added as owner, can have up to 5 total including owner)
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseClient();
    const body = await request.json();
    const parsed = createCircleSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid data", issues: parsed.error.format() },
        { status: 400 }
      );
    }

    const { userId, name } = parsed.data;

    // Create circle
    const { data: circle, error: circleError } = await supabase
      .from("circles")
      .insert({ owner_id: userId, name })
      .select("id, name, owner_id, emergency_window_until, created_at")
      .single();

    if (circleError || !circle) {
      console.error("Circle creation failed:", circleError);
      return NextResponse.json(
        { error: "Failed to create circle" },
        { status: 500 }
      );
    }

    // Add owner as member with "owner" role
    const { error: memberError } = await supabase
      .from("circle_members")
      .insert({ circle_id: circle.id, member_id: userId, role: "owner" });

    if (memberError) {
      console.error("Failed to add owner as member:", memberError);
      // Note: Circle was created but we failed to add owner as member
      return NextResponse.json(
        { error: "Failed to initialize circle membership" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        circle: {
          ...circle,
          memberCount: 1,
          isOwner: true,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/circles error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
