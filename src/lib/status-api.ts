export type StatusKind = "safe" | "help" | "unknown";

export type GeoPoint = {
  lat: number;
  lng: number;
  accuracy?: number;
};

export type CircleStatus = {
  id: string;
  name: string;
  status: StatusKind;
  updatedAt: string;
  note?: string;
  location?: GeoPoint;
  batteryPct?: number;
  isYou?: boolean;
};

export type SendStatusPayload = {
  userId?: string;
  name?: string;
  status: StatusKind;
  note?: string;
  location?: GeoPoint | null;
  batteryPct?: number;
};

export async function fetchStatuses(): Promise<CircleStatus[]> {
  const res = await fetch("/api/status", { cache: "no-store" });

  if (!res.ok) {
    throw new Error("Failed to load statuses");
  }

  const json = (await res.json()) as { circle: CircleStatus[] };
  return json.circle;
}

export async function sendStatus(payload: SendStatusPayload) {
  const res = await fetch("/api/status", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const message = await res.text();
    throw new Error(message || "Unable to send status");
  }

  return res.json();
}
