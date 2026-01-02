"use client";

import { useEffect, useState } from "react";
import { supabase } from "./supabase-client";
import { RealtimeChannel } from "@supabase/supabase-js";

export type StatusUpdate = {
  id: string;
  user_id: string;
  circle_id: string;
  status: "safe" | "help" | "unknown";
  lat: number | null;
  lng: number | null;
  accuracy_m: number | null;
  battery_pct: number | null;
  note: string | null;
  created_at: string;
};

export type CircleMemberUpdate = {
  id: string;
  circle_id: string;
  member_id: string;
  role: "owner" | "member";
  joined_at: string;
};

export type ProfileUpdate = {
  id: string;
  email: string | null;
  phone: string | null;
  display_name: string | null;
  updated_at: string;
};

/**
 * Subscribe to real-time status updates for a specific circle
 * Triggers callback when new statuses are inserted
 */
export function useStatusUpdates(
  circleId: string | null,
  onStatusUpdate: (status: StatusUpdate) => void
) {
  useEffect(() => {
    if (!supabase || !circleId) return;

    const channel: RealtimeChannel = supabase
      .channel(`circle:${circleId}:statuses`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "statuses",
          filter: `circle_id=eq.${circleId}`,
        },
        (payload) => {
          console.log("Status update received:", payload);
          onStatusUpdate(payload.new as StatusUpdate);
        }
      )
      .subscribe((status) => {
        console.log(`Realtime subscription status: ${status}`);
      });

    return () => {
      console.log(`Unsubscribing from circle:${circleId}:statuses`);
      if (supabase) {
        supabase.removeChannel(channel);
      }
    };
  }, [circleId, onStatusUpdate]);
}

/**
 * Subscribe to real-time member changes for a specific circle
 * Triggers callback when members are added or removed
 */
export function useCircleMemberUpdates(
  circleId: string | null,
  onMemberChange: (
    event: "INSERT" | "DELETE",
    member: CircleMemberUpdate
  ) => void
) {
  useEffect(() => {
    if (!supabase || !circleId) return;

    const channel: RealtimeChannel = supabase
      .channel(`circle:${circleId}:members`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "circle_members",
          filter: `circle_id=eq.${circleId}`,
        },
        (payload) => {
          console.log("Member added:", payload);
          onMemberChange("INSERT", payload.new as CircleMemberUpdate);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "circle_members",
          filter: `circle_id=eq.${circleId}`,
        },
        (payload) => {
          console.log("Member removed:", payload);
          onMemberChange("DELETE", payload.old as CircleMemberUpdate);
        }
      )
      .subscribe((status) => {
        console.log(`Circle members subscription status: ${status}`);
      });

    return () => {
      console.log(`Unsubscribing from circle:${circleId}:members`);
      if (supabase) {
        supabase.removeChannel(channel);
      }
    };
  }, [circleId, onMemberChange]);
}

/**
 * Subscribe to real-time profile updates for a specific user
 * Triggers callback when profile is updated
 */
export function useProfileUpdates(
  userId: string | null,
  onProfileUpdate: (profile: ProfileUpdate) => void
) {
  useEffect(() => {
    if (!supabase || !userId) return;

    const channel: RealtimeChannel = supabase
      .channel(`profile:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "profiles",
          filter: `id=eq.${userId}`,
        },
        (payload) => {
          console.log("Profile updated:", payload);
          onProfileUpdate(payload.new as ProfileUpdate);
        }
      )
      .subscribe((status) => {
        console.log(`Profile subscription status: ${status}`);
      });

    return () => {
      console.log(`Unsubscribing from profile:${userId}`);
      if (supabase) {
        supabase.removeChannel(channel);
      }
    };
  }, [userId, onProfileUpdate]);
}

/**
 * Subscribe to all status updates across all circles the user is in
 * Useful for global notifications
 */
export function useAllStatusUpdates(
  userId: string | null,
  onStatusUpdate: (status: StatusUpdate) => void
) {
  const [circleIds, setCircleIds] = useState<string[]>([]);

  useEffect(() => {
    if (!supabase || !userId) return;

    // Fetch user's circles
    const fetchCircles = async () => {
      if (!supabase) return;
      
      const { data, error } = await supabase
        .from("circle_members")
        .select("circle_id")
        .eq("member_id", userId);

      if (error) {
        console.error("Failed to fetch circles:", error);
        return;
      }

      setCircleIds(data?.map((m) => m.circle_id) || []);
    };

    fetchCircles();
  }, [userId]);

  useEffect(() => {
    if (!supabase || circleIds.length === 0) return;

    const channels: RealtimeChannel[] = circleIds.map((circleId) =>
      supabase
        .channel(`all-statuses:${circleId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "statuses",
            filter: `circle_id=eq.${circleId}`,
          },
          (payload) => {
            onStatusUpdate(payload.new as StatusUpdate);
          }
        )
        .subscribe()
    );

    return () => {
      if (supabase) {
        channels.forEach((channel) => supabase.removeChannel(channel));
      }
    };
  }, [circleIds, onStatusUpdate]);
}

/**
 * Generic hook to subscribe to any table changes
 * Flexible for custom real-time needs
 */
export function useRealtimeSubscription<T = any>(
  channelName: string,
  table: string,
  event: "INSERT" | "UPDATE" | "DELETE" | "*",
  filter: string | null,
  onUpdate: (payload: T) => void,
  enabled: boolean = true
) {
  useEffect(() => {
    if (!supabase || !enabled) return;

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event,
          schema: "public",
          table,
          ...(filter && { filter }),
        },
        (payload: any) => {
          onUpdate(payload as T);
        }
      )
      .subscribe((status) => {
        console.log(`${channelName} subscription status: ${status}`);
      });

    return () => {
      if (supabase) {
        supabase.removeChannel(channel);
      }
    };
  }, [channelName, table, event, filter, onUpdate, enabled]);
}
