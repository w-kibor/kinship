"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

interface Member {
  member_id: string;
  role: string;
  profiles: {
    phone: string;
    email?: string;
  };
}

interface Circle {
  id: string;
  name: string;
  owner_id: string;
}

async function fetchUserCircles(userId: string): Promise<Circle[]> {
  try {
    const response = await fetch(`/api/circles?userId=${userId}`);
    if (!response.ok) {
      console.error("Failed to fetch circles:", response.statusText);
      return [];
    }
    const data = await response.json();
    return data.circles || [];
  } catch (error) {
    console.error("Error fetching circles:", error);
    return [];
  }
}

async function fetchCircleMembers(circleId: string): Promise<Member[]> {
  try {
    const response = await fetch(`/api/circles/${circleId}/members`);
    if (!response.ok) {
      console.error("Failed to fetch members:", response.statusText);
      return [];
    }
    const data = await response.json();
    return data.members || [];
  } catch (error) {
    console.error("Error fetching members:", error);
    return [];
  }
}

export function ManageContacts({ userId }: { userId: string }) {
  const [isOpen, setIsOpen] = useState(false);

  const { data: circles = [] } = useQuery<Circle[]>({
    queryKey: ["circles", userId],
    queryFn: () => fetchUserCircles(userId),
    enabled: isOpen,
  });

  const primaryCircle = circles[0];

  const { data: members = [] } = useQuery<Member[]>({
    queryKey: ["circle-members", primaryCircle?.id],
    queryFn: () => fetchCircleMembers(primaryCircle.id),
    enabled: !!primaryCircle?.id && isOpen,
  });

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-20 right-4 bg-white text-gray-700 p-3 rounded-full shadow-lg hover:shadow-xl transition-shadow border border-gray-200"
        title="Manage Contacts"
      >
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
          />
        </svg>
      </button>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50">
      <div className="bg-white w-full sm:max-w-lg sm:rounded-lg max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between">
          <h2 className="text-xl font-bold">Emergency Contacts</h2>
          <button
            onClick={() => setIsOpen(false)}
            className="p-2 hover:bg-gray-100 rounded-full"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">
              {members.length}/5 Contacts
            </span>
            {members.length < 5 && (
              <Link
                href="/setup"
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                onClick={() => {
                  localStorage.removeItem("kinship_setup_complete");
                }}
              >
                + Add Contact
              </Link>
            )}
          </div>

          {members.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-gray-400 mb-2">
                <svg
                  className="w-16 h-16 mx-auto"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
              </div>
              <p className="text-gray-600 mb-4">No contacts yet</p>
              <Link
                href="/setup"
                className="inline-block bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
                onClick={() => {
                  localStorage.removeItem("kinship_setup_complete");
                }}
              >
                Add Your First Contact
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {members.map((member, idx) => (
                <div
                  key={member.member_id}
                  className="p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">
                        {member.profiles.phone}
                      </div>
                      {member.profiles.email && (
                        <div className="text-sm text-gray-600 mt-1">
                          {member.profiles.email}
                        </div>
                      )}
                      <div className="text-xs text-gray-500 mt-1">
                        {member.role === "owner" ? "Owner" : `Contact ${idx + 1}`}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="pt-4 border-t border-gray-200 text-sm text-gray-600">
            <p className="mb-2">
              <strong>Your Emergency Circle:</strong>
            </p>
            <ul className="space-y-1 text-xs">
              <li>• These contacts receive your status updates</li>
              <li>• They can share their status with you</li>
              <li>• Maximum 5 people in your circle</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
