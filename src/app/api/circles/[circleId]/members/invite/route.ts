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

const inviteMemberSchema = z.object({
  phone: z.string().min(1, "Phone number required"),
  email: z.string().email("Valid email required").optional(),
});

/**
 * POST /api/circles/:circleId/members/invite
 * Add a member to circle by phone/email (creates profile if needed)
 * Maximum 5 members per circle including owner
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { circleId: string } }
) {
  try {
    const supabase = getSupabaseClient();
    const circleId = params.circleId;
    const body = await request.json();
    const parsed = inviteMemberSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid data", issues: parsed.error.format() },
        { status: 400 }
      );
    }

    const { phone, email } = parsed.data;

    // Check if circle exists
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

    // Count current members (including owner)
    const { count, error: countError } = await supabase
      .from("circle_members")
      .select("*", { count: "exact", head: true })
      .eq("circle_id", circleId);

    if (countError) {
      console.error("Error counting members:", countError);
      return NextResponse.json(
        { error: "Failed to count members" },
        { status: 500 }
      );
    }

    // Enforce maximum of 5 members (including owner)
    if (count !== null && count >= 5) {
      return NextResponse.json(
        { error: "Circle is full. Maximum 5 members allowed." },
        { status: 400 }
      );
    }

    // Find or create profile
    let profileId: string;
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("phone", phone)
      .single();

    if (existingProfile) {
      profileId = existingProfile.id;
    } else {
      // Create new profile
      const { data: newProfile, error: profileError } = await supabase
        .from("profiles")
        .insert({ phone, email })
        .select("id")
        .single();

      if (profileError || !newProfile) {
        console.error("Error creating profile:", profileError);
        return NextResponse.json(
          { error: "Failed to create profile" },
          { status: 500 }
        );
      }

      profileId = newProfile.id;
    }

    // Check if already a member
    const { data: existingMember } = await supabase
      .from("circle_members")
      .select("member_id")
      .eq("circle_id", circleId)
      .eq("member_id", profileId)
      .single();

    if (existingMember) {
      return NextResponse.json(
        { error: "User is already a member of this circle" },
        { status: 400 }
      );
    }

    // Add to circle
    const { error: memberError } = await supabase
      .from("circle_members")
      .insert({
        circle_id: circleId,
        member_id: profileId,
        role: "member",
      });

    if (memberError) {
      console.error("Error adding member:", memberError);
      return NextResponse.json(
        { error: "Failed to add member" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        memberId: profileId,
        message: "Member added successfully",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/circles/:circleId/members/invite error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
