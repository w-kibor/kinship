"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleStatus, SendStatusPayload, fetchStatuses, sendStatus } from "@/lib/status-api";
import { StatusCard } from "@/components/status-card";
import { ServiceWorkerClient } from "@/components/service-worker-client";
import { ManageContacts } from "@/components/manage-contacts";

type StatusKind = "safe" | "help" | "unknown";

async function getLocation(): Promise<SendStatusPayload["location"]> {
  if (typeof navigator === "undefined" || !navigator.geolocation) return null;

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
      },
      () => resolve(null),
      { maximumAge: 60_000, timeout: 4_000 }
    );
  });
}

type BatteryCapableNavigator = Navigator & {
  getBattery?: () => Promise<{ level: number }>;
};

async function getBattery(): Promise<number | undefined> {
  if (typeof navigator === "undefined") return undefined;

  const nav = navigator as BatteryCapableNavigator;
  if (!nav.getBattery) return undefined;

  try {
    const battery = await nav.getBattery();
    return Math.round(battery.level * 100);
  } catch (error) {
    console.warn("Battery API unavailable", error);
    return undefined;
  }
}

export default function Home() {
  const [note, setNote] = useState("");
  const [isMounted, setIsMounted] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // Check if setup is complete and get userId
  useEffect(() => {
    const setupComplete = localStorage.getItem("kinship_setup_complete");
    const storedUserId = localStorage.getItem("kinship_user_id");
    
    if (!setupComplete) {
      window.location.href = "/setup";
      return;
    }
    
    if (storedUserId) {
      setUserId(storedUserId);
    }
  }, []);

  const { data: circle, isFetching, error } = useQuery<CircleStatus[]>({
    queryKey: ["circle-status"],
    queryFn: fetchStatuses,
    refetchInterval: 30_000,
  });

  useEffect(() => {
    setIsMounted(true);
    setIsOnline(navigator.onLine);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const mutation = useMutation({
    mutationFn: async (status: StatusKind) => {
      const [location, batteryPct] = await Promise.all([getLocation(), getBattery()]);

      const payload: SendStatusPayload = {
        status,
        location,
        batteryPct,
        note: note.trim() || undefined,
      };

      return sendStatus(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["circle-status"] });
      setNote("");
    },
  });

  const headline = useMemo(() => {
    if (!isOnline) return "Offline — will send when reconnected";
    if (mutation.isPending) return "Sending heartbeat…";
    if (error) return "Having trouble fetching the circle";
    return "Tap once to reassure your circle";
  }, [isOnline, mutation.isPending, error]);

  const latestYou = circle?.find((member) => member.isYou);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-50">
      <ServiceWorkerClient />
      <div className="mx-auto flex max-w-5xl flex-col gap-8 px-4 pb-16 pt-12 sm:px-8">
        <header className="flex flex-col gap-2">
          <p className="text-sm uppercase tracking-[0.2em] text-indigo-200">Kinship · Emergency Mesh</p>
          <h1 className="text-3xl font-semibold leading-tight sm:text-4xl">
            Low-bandwidth safety heartbeat
          </h1>
          <p className="max-w-2xl text-base text-indigo-100/80">
            One tap (or SMS fallback) to let your Circle of 5 know you are safe. Works offline, queues updates, and shows last-known location when signals fade.
          </p>
          <div className="flex items-center gap-2 text-sm text-indigo-100/80">
            {isMounted && (
              <>
                <span className={isOnline ? "h-2 w-2 rounded-full bg-emerald-400" : "h-2 w-2 rounded-full bg-amber-400"} />
              </>
            )}
            {headline}
          </div>
        </header>

        <section className="grid gap-6 rounded-3xl border border-indigo-300/10 bg-white/5 p-6 shadow-lg shadow-indigo-900/40 backdrop-blur sm:grid-cols-3 sm:items-center">
          <div className="sm:col-span-2">
            <p className="text-sm text-indigo-100/80">Status note (optional, 240 chars)</p>
            <textarea
              className="mt-2 w-full rounded-2xl border border-indigo-100/20 bg-white/5 p-3 text-sm text-slate-100 outline-none ring-2 ring-transparent transition focus:border-indigo-200/50 focus:ring-indigo-400/40"
              rows={3}
              placeholder="Short note for your circle..."
              maxLength={240}
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-3">
            <button
              onClick={() => mutation.mutate("safe")}
              disabled={mutation.isPending}
              className="w-full rounded-2xl bg-emerald-400 px-4 py-3 text-base font-semibold text-emerald-950 shadow-md shadow-emerald-900/40 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-70"
            >
              I am safe
            </button>
            <button
              onClick={() => mutation.mutate("help")}
              disabled={mutation.isPending}
              className="w-full rounded-2xl border border-amber-200/60 bg-amber-100/20 px-4 py-3 text-base font-semibold text-amber-50 shadow-md shadow-amber-900/30 transition hover:bg-amber-100/30 disabled:cursor-not-allowed disabled:opacity-70"
            >
              I need help
            </button>
            <p className="text-xs text-indigo-100/70">
              Offline? Your tap is queued and will auto-send when a signal returns.
            </p>
          </div>
        </section>

        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-indigo-200">Circle of 5</p>
              <p className="text-lg font-semibold text-white">Last-known heartbeat</p>
            </div>
            <button
              className="rounded-full border border-indigo-100/30 px-4 py-2 text-sm text-indigo-50 transition hover:bg-indigo-100/10"
              onClick={() => queryClient.invalidateQueries({ queryKey: ["circle-status"] })}
            >
              Refresh
            </button>
          </div>

          {isFetching && !circle && (
            <p className="text-indigo-100/80">Loading circle…</p>
          )}

          {error && (
            <p className="rounded-2xl border border-rose-200/40 bg-rose-100/10 px-4 py-3 text-sm text-rose-50">
              Could not fetch the circle. We will retry in the background.
            </p>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {circle?.map((entry) => (
              <StatusCard key={entry.id} entry={entry} />
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-indigo-100/10 bg-white/5 p-5 text-sm text-indigo-100/80 shadow-inner shadow-indigo-900/40 backdrop-blur">
          <p className="font-semibold text-indigo-50">Last sync</p>
          <p className="text-indigo-100/70">
            {latestYou ? `Your last heartbeat: ${new Date(latestYou.updatedAt).toLocaleString()}` : "No heartbeat yet."}
          </p>
          <p className="mt-2 text-indigo-100/70">
            SMS fallback: text SAFE &lt;PIN&gt; &lt;LAT,LNG&gt; to your Twilio number. Service worker queues requests and retries when connectivity returns.
          </p>
        </section>
      </div>

      {/* Manage Contacts Button */}
      {userId && <ManageContacts userId={userId} />}
    </div>
  );
}
