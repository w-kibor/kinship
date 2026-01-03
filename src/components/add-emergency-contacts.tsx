"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

interface Contact {
  phone: string;
  email?: string;
}

interface Member {
  member_id: string;
  profiles: {
    phone: string;
    email?: string;
  };
}

interface AddEmergencyContactsProps {
  userId: string;
  circleId?: string;
  onComplete?: () => void;
}

async function createCircle(userId: string, name: string) {
  try {
    const response = await fetch("/api/circles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, name }),
    });

    if (!response.ok) {
      try {
        const error = await response.json();
        throw new Error(error.error || `Failed to create circle: ${response.statusText}`);
      } catch (e) {
        if (e instanceof Error) throw e;
        throw new Error(`Failed to create circle: ${response.statusText}`);
      }
    }

    return response.json();
  } catch (error) {
    console.error("Error creating circle:", error);
    throw error instanceof Error ? error : new Error("Failed to create circle");
  }
}

async function addMember(circleId: string, contact: Contact) {
  try {
    const response = await fetch(`/api/circles/${circleId}/members/invite`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(contact),
    });

    if (!response.ok) {
      try {
        const error = await response.json();
        throw new Error(error.error || `Failed to add member: ${response.statusText}`);
      } catch (e) {
        if (e instanceof Error) throw e;
        throw new Error(`Failed to add member: ${response.statusText}`);
      }
    }

    return response.json();
  } catch (error) {
    console.error("Error adding member:", error);
    throw error instanceof Error ? error : new Error("Failed to add member");
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

export function AddEmergencyContacts({ userId, circleId: initialCircleId, onComplete }: AddEmergencyContactsProps) {
  const [circleId, setCircleId] = useState(initialCircleId);
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const queryClient = useQueryClient();

  // Fetch existing members
  const { data: members = [] } = useQuery<Member[]>({
    queryKey: ["circle-members", circleId],
    queryFn: () => (circleId ? fetchCircleMembers(circleId) : Promise.resolve([])),
    enabled: !!circleId,
  });

  // Create circle mutation (if not exists)
  const createCircleMutation = useMutation({
    mutationFn: () => createCircle(userId, "My Emergency Circle"),
    onSuccess: (data) => {
      setCircleId(data.circle.id);
      queryClient.invalidateQueries({ queryKey: ["circles", userId] });
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  // Add member mutation
  const addMemberMutation = useMutation({
    mutationFn: (contact: Contact) => {
      if (!circleId) throw new Error("No circle found");
      return addMember(circleId, contact);
    },
    onSuccess: () => {
      setPhone("");
      setEmail("");
      setError("");
      queryClient.invalidateQueries({ queryKey: ["circle-members", circleId] });
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  const handleAddContact = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!phone.trim()) {
      setError("Phone number is required");
      return;
    }

    // Create circle if it doesn't exist
    if (!circleId) {
      await createCircleMutation.mutateAsync();
    }

    // Add the member
    addMemberMutation.mutate({ phone: phone.trim(), email: email.trim() || undefined });
  };

  const memberCount = members.length;
  const canAddMore = memberCount < 5;
  const isLoading = createCircleMutation.isPending || addMemberMutation.isPending;

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold mb-2">Add Emergency Contacts</h2>
        <p className="text-gray-600 mb-4">
          Add up to 5 people who you want to notify in case of emergency.
        </p>
        
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">
              Contacts Added: {memberCount}/5
            </span>
            {!canAddMore && (
              <span className="text-sm text-amber-600 font-medium">Circle Full</span>
            )}
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all"
              style={{ width: `${(memberCount / 5) * 100}%` }}
            />
          </div>
        </div>

        {members.length > 0 && (
          <div className="mb-6 space-y-2">
            <h3 className="font-semibold text-sm text-gray-700 mb-2">Current Contacts:</h3>
            {members.map((member, idx) => (
              <div
                key={member.member_id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div>
                  <div className="font-medium">{member.profiles.phone}</div>
                  {member.profiles.email && (
                    <div className="text-sm text-gray-600">{member.profiles.email}</div>
                  )}
                </div>
                <div className="text-sm text-gray-500">Contact {idx + 1}</div>
              </div>
            ))}
          </div>
        )}

        {canAddMore && (
          <form onSubmit={handleAddContact} className="space-y-4">
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                Phone Number *
              </label>
              <input
                type="tel"
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+254712345678"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={isLoading}
                required
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email (Optional)
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="contact@example.com"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={isLoading}
              />
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading || !canAddMore}
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? "Adding..." : "Add Contact"}
            </button>
          </form>
        )}

        {memberCount > 0 && onComplete && (
          <button
            onClick={onComplete}
            className="mt-4 w-full bg-green-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-green-700 transition-colors"
          >
            {canAddMore ? "Continue (Add More Later)" : "Complete Setup"}
          </button>
        )}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
        <p className="font-semibold mb-2">💡 How it works:</p>
        <ul className="space-y-1 list-disc list-inside">
          <li>These contacts will be notified when you send a status update</li>
          <li>They can also share their status with you</li>
          <li>You can add or remove contacts anytime</li>
          <li>Maximum 5 people in your emergency circle</li>
        </ul>
      </div>
    </div>
  );
}
