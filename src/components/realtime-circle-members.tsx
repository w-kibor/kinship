"use client";

import { useEffect, useState } from "react";
import { useCircleMemberUpdates } from "@/lib/realtime-hooks";
import type { CircleMemberUpdate } from "@/lib/realtime-hooks";

type Member = {
  id: string;
  display_name: string | null;
  email: string | null;
  role: "owner" | "member";
};

type RealtimeCircleMembersProps = {
  circleId: string;
  initialMembers: Member[];
};

/**
 * Example component showing real-time circle member updates
 * Updates the member list as people join/leave
 */
export function RealtimeCircleMembers({
  circleId,
  initialMembers,
}: RealtimeCircleMembersProps) {
  const [members, setMembers] = useState<Member[]>(initialMembers);
  const [recentChanges, setRecentChanges] = useState<string[]>([]);

  useCircleMemberUpdates(circleId, (event, memberUpdate) => {
    if (event === "INSERT") {
      // In production, fetch member details from profiles table
      const newMember: Member = {
        id: memberUpdate.member_id,
        display_name: null,
        email: null,
        role: memberUpdate.role,
      };
      setMembers((prev) => [...prev, newMember]);
      setRecentChanges((prev) =>
        [`Member joined`, ...prev].slice(0, 5)
      );
    } else if (event === "DELETE") {
      setMembers((prev) =>
        prev.filter((m) => m.id !== memberUpdate.member_id)
      );
      setRecentChanges((prev) =>
        [`Member left`, ...prev].slice(0, 5)
      );
    }

    // Clear change notification after 3 seconds
    setTimeout(() => {
      setRecentChanges((prev) => prev.slice(0, -1));
    }, 3000);
  });

  return (
    <div className="border rounded-lg p-4">
      <div className="mb-4">
        <h3 className="font-semibold">Circle Members ({members.length}/5)</h3>
        {recentChanges.length > 0 && (
          <div className="mt-2 space-y-1">
            {recentChanges.map((change, idx) => (
              <p
                key={idx}
                className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded"
              >
                {change}
              </p>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-2">
        {members.map((member) => (
          <div
            key={member.id}
            className="flex items-center justify-between p-2 bg-gray-50 rounded"
          >
            <div>
              <p className="font-medium text-sm">
                {member.display_name || member.email || "Unknown"}
              </p>
              <p className="text-xs text-gray-500">{member.role}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
