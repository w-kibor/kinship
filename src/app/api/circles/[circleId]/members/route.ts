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

const addMemberSchema = z.object({
  memberId: z.string().uuid("Invalid member ID"),
  requesterId: z.string().uuid("Invalid requester ID"),
});

/**
 * GET /api/circles/[circleId]/members
 * List all members in a circle
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { circleId: string } }
) {
  try {
    const supabase = getSupabaseClient();
    const circleId = params.circleId;

    const { data: members, error } = await supabase
      .from("circle_members")
      .select(
        `
        member_id,
        role,
        created_at,
        profiles (
          id,
          email,
          phone
        )
        `
      )
      .eq("circle_id", circleId);

    if (error) {
      console.error("Error fetching members:", error);
      return NextResponse.json(
        { error: "Failed to fetch members" },
        { status: 500 }
      );
    }

    const formattedMembers = members?.map((m: any) => ({
      id: m.member_id,
      role: m.role,
      email: m.profiles?.email,
      phone: m.profiles?.phone,
      joinedAt: m.created_at,
    })) || [];

    return NextResponse.json(
      { members: formattedMembers, count: formattedMembers.length },
      { status: 200 }
    );
  } catch (error) {
    console.error("GET /api/circles/[circleId]/members error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/circles/[circleId]/members
 * Add a member to a circle (Circle of 5 enforcement: 4 members + 1 owner max)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { circleId: string } }
) {
  try {
    const supabase = getSupabaseClient();
    const circleId = params.circleId;
    const body = await request.json();
    const parsed = addMemberSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid data", issues: parsed.error.format() },
        { status: 400 }
      );
    }

    const { memberId, requesterId } = parsed.data;

    // Verify requester is circle owner
    const { data: circle, error: circleError } = await supabase
      .from("circles")
      .select("owner_id")
      .eq("id", circleId)
      .single();

    if (circleError || !circle) {
      return NextResponse.json(
        { error: "Circle not found" },
        { status: 404 }
      );
    }

    if (circle.owner_id !== requesterId) {
      return NextResponse.json(
        { error: "Only circle owner can add members" },
        { status: 403 }
      );
    }

    // Check current member count
    const { data: members, error: countError } = await supabase
      .from("circle_members")
      .select("member_id")
      .eq("circle_id", circleId);

    if (countError) {
      console.error("Error checking member count:", countError);
      return NextResponse.json(
        { error: "Failed to check member count" },
        { status: 500 }
      );
    }

    // Enforce Circle of 5 (including owner)
    if ((members?.length || 0) >= 5) {
      return NextResponse.json(
        { error: "Circle is full (max 5 members including owner)" },
        { status: 400 }
      );
    }

    // Check if member already exists
    const alreadyMember = members?.some((m: any) => m.member_id === memberId);
    if (alreadyMember) {
      return NextResponse.json(
        { error: "User is already a member of this circle" },
        { status: 400 }
      );
    }

    // Ensure profile exists for new member
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", memberId)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: "Member profile not found" },
        { status: 404 }
      );
    }

    // Add member with "member" role
    const { data: newMember, error: addError } = await supabase
      .from("circle_members")
      .insert({ circle_id: circleId, member_id: memberId, role: "member" })
      .select("member_id, role, created_at")
      .single();

    if (addError || !newMember) {
      console.error("Failed to add member:", addError);
      return NextResponse.json(
        { error: "Failed to add member to circle" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        member: {
          id: newMember.member_id,
          role: newMember.role,
          joinedAt: newMember.created_at,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/circles/[circleId]/members error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/circles/[circleId]/members/[memberId]
 * Remove a member from a circle (owner can remove anyone, members can only leave)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { circleId: string } }
) {
  try {
    const supabase = getSupabaseClient();
    const { searchParams } = new URL(request.url);
    const memberId = searchParams.get("memberId");
    const requesterId = searchParams.get("requesterId");

    if (!memberId || !requesterId) {
      return NextResponse.json(
        { error: "Missing memberId or requesterId parameter" },
        { status: 400 }
      );
    }

    // Verify requester is owner or removing themselves
    const { data: circle, error: circleError } = await supabase
      .from("circles")
      .select("owner_id")
      .eq("id", params.circleId)
      .single();

    if (circleError || !circle) {
      return NextResponse.json(
        { error: "Circle not found" },
        { status: 404 }
      );
    }

    const isOwner = circle.owner_id === requesterId;
    const isRemovingSelf = requesterId === memberId;

    if (!isOwner && !isRemovingSelf) {
      return NextResponse.json(
        { error: "You can only remove yourself or be owner to remove others" },
        { status: 403 }
      );
    }

    // Remove member
    const { error: deleteError } = await supabase
      .from("circle_members")
      .delete()
      .eq("circle_id", params.circleId)
      .eq("member_id", memberId);

    if (deleteError) {
      console.error("Failed to remove member:", deleteError);
      return NextResponse.json(
        { error: "Failed to remove member from circle" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: true, message: "Member removed from circle" },
      { status: 200 }
    );
  } catch (error) {
    console.error("DELETE /api/circles/[circleId]/members error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
