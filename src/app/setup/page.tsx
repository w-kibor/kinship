"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AddEmergencyContacts } from "@/components/add-emergency-contacts";

export default function SetupPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    // Get userId from localStorage or auth
    // For now, using a mock userId - replace with actual auth
    const storedUserId = localStorage.getItem("kinship_user_id");
    if (storedUserId) {
      setUserId(storedUserId);
    } else {
      // Generate a temporary ID (in production, this would come from auth)
      const tempUserId = crypto.randomUUID();
      localStorage.setItem("kinship_user_id", tempUserId);
      setUserId(tempUserId);
    }
  }, []);

  const handleComplete = () => {
    localStorage.setItem("kinship_setup_complete", "true");
    router.push("/");
  };

  if (!userId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <AddEmergencyContacts userId={userId} onComplete={handleComplete} />
    </div>
  );
}
