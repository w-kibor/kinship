import { NextResponse } from "next/server";
import { z } from "zod";
import { nanoid } from "nanoid";

const circleMembers = [
  { id: "you", name: "You", isYou: true },
  { id: "1", name: "Alex" },
  { id: "2", name: "Sam" },
  { id: "3", name: "Jordan" },
  { id: "4", name: "Casey" },
];

const statusStore = new Map<string, CircleStatus>();

const bodySchema = z.object({
  userId: z.string().optional(),
  name: z.string().optional(),
  status: z.enum(["safe", "help", "unknown"]),
  note: z.string().trim().max(240).optional(),
  batteryPct: z.number().min(0).max(100).optional(),
  location: z
    .object({
      lat: z.number(),
      lng: z.number(),
      accuracy: z.number().optional(),
    })
    .nullable()
    .optional(),
});

export type CircleStatus = {
  id: string;
  name: string;
  status: "safe" | "help" | "unknown";
  updatedAt: string;
  note?: string;
  location?: {
    lat: number;
    lng: number;
    accuracy?: number;
  } | null;
  batteryPct?: number;
  isYou?: boolean;
};

export async function GET() {
  const now = new Date();
  const circle = circleMembers.map((member, index) => {
    const existing = statusStore.get(member.id);

    if (existing) {
      return existing;
    }

    const fallback: CircleStatus = {
      id: member.id,
      name: member.name,
      status: index === 0 ? "safe" : "unknown",
      updatedAt: now.toISOString(),
      note: index === 0 ? "Seed heartbeat" : undefined,
      isYou: member.isYou,
    };

    statusStore.set(member.id, fallback);
    return fallback;
  });

  return NextResponse.json({ circle }, { status: 200 });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => undefined);
  const parsed = bodySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", issues: parsed.error.format() },
      { status: 400 }
    );
  }

  const incoming = parsed.data;
  const memberId = incoming.userId ?? "you";
  const memberName = incoming.name ??
    circleMembers.find((member) => member.id === memberId)?.name ??
    `Guest-${memberId}`;

  const entry: CircleStatus = {
    id: memberId,
    name: memberName,
    status: incoming.status,
    note: incoming.note,
    updatedAt: new Date().toISOString(),
    location: incoming.location ?? undefined,
    batteryPct: incoming.batteryPct,
    isYou: memberId === "you",
  };

  statusStore.set(memberId, entry);

  const ack = {
    ackId: nanoid(),
    receivedAt: entry.updatedAt,
    queued: false,
    entry,
  };

  return NextResponse.json(ack, { status: 201 });
}
