"use client";

import { useEffect, useState } from "react";
import { useStatusUpdates } from "@/lib/realtime-hooks";
import type { StatusUpdate } from "@/lib/realtime-hooks";

type RealtimeStatusFeedProps = {
  circleId: string;
  onNewStatus?: (status: StatusUpdate) => void;
};

/**
 * Example component showing real-time status updates
 * Displays a live feed of statuses as they come in
 */
export function RealtimeStatusFeed({
  circleId,
  onNewStatus,
}: RealtimeStatusFeedProps) {
  const [statuses, setStatuses] = useState<StatusUpdate[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Simulate connection status (in production, track Supabase channel state)
    setIsConnected(true);
    return () => setIsConnected(false);
  }, [circleId]);

  useStatusUpdates(circleId, (newStatus) => {
    setStatuses((prev) => [newStatus, ...prev].slice(0, 50)); // Keep last 50
    onNewStatus?.(newStatus);
  });

  return (
    <div className="border rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold">Live Status Feed</h3>
        <div className="flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full ${
              isConnected ? "bg-green-500" : "bg-gray-400"
            }`}
          />
          <span className="text-sm text-gray-600">
            {isConnected ? "Connected" : "Disconnected"}
          </span>
        </div>
      </div>

      <div className="space-y-2 max-h-96 overflow-y-auto">
        {statuses.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-8">
            Waiting for status updates...
          </p>
        ) : (
          statuses.map((status) => (
            <div
              key={status.id}
              className="p-3 bg-gray-50 rounded border border-gray-200"
            >
              <div className="flex items-center justify-between">
                <span
                  className={`px-2 py-1 rounded text-xs font-medium ${
                    status.status === "safe"
                      ? "bg-green-100 text-green-800"
                      : status.status === "help"
                      ? "bg-red-100 text-red-800"
                      : "bg-gray-100 text-gray-800"
                  }`}
                >
                  {status.status.toUpperCase()}
                </span>
                <span className="text-xs text-gray-500">
                  {new Date(status.created_at).toLocaleTimeString()}
                </span>
              </div>
              {status.note && (
                <p className="text-sm mt-2 text-gray-700">{status.note}</p>
              )}
              {status.lat && status.lng && (
                <p className="text-xs text-gray-500 mt-1">
                  📍 {status.lat.toFixed(4)}, {status.lng.toFixed(4)}
                </p>
              )}
              {status.battery_pct !== null && (
                <p className="text-xs text-gray-500">
                  🔋 {status.battery_pct}%
                </p>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
