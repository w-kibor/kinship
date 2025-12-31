import { CircleStatus } from "@/lib/status-api";
import clsx from "clsx";

const palette: Record<CircleStatus["status"], string> = {
  safe: "bg-emerald-100 text-emerald-800 border border-emerald-200",
  help: "bg-amber-100 text-amber-900 border border-amber-200",
  unknown: "bg-slate-100 text-slate-700 border border-slate-200",
};

const statusLabel: Record<CircleStatus["status"], string> = {
  safe: "Safe",
  help: "Needs help",
  unknown: "No signal",
};

function formatRelative(iso: string) {
  const date = new Date(iso);
  const diff = Date.now() - date.getTime();
  const minutes = Math.round(diff / 60000);

  if (minutes < 1) return "just now";
  if (minutes === 1) return "1 min ago";
  if (minutes < 60) return `${minutes} mins ago`;
  const hours = Math.round(minutes / 60);
  if (hours === 1) return "1 hour ago";
  return `${hours} hours ago`;
}

export function StatusCard({ entry }: { entry: CircleStatus }) {
  return (
    <div className="flex w-full flex-col gap-2 rounded-2xl border border-slate-200/70 bg-white/70 p-4 shadow-sm shadow-slate-200 backdrop-blur-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="h-10 w-10 rounded-full bg-slate-100 text-center text-lg font-semibold text-slate-600 flex items-center justify-center">
            {entry.name.slice(0, 1)}
          </div>
          <div className="flex flex-col">
            <span className="text-base font-semibold text-slate-900">
              {entry.name}
            </span>
            <span className="text-xs text-slate-500">
              Updated {formatRelative(entry.updatedAt)}
            </span>
          </div>
        </div>
        <span className={clsx("rounded-full px-3 py-1 text-xs font-semibold", palette[entry.status])}>
          {statusLabel[entry.status]}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3 text-sm text-slate-600 sm:grid-cols-3">
        <div>
          <p className="text-xs uppercase text-slate-400">Location</p>
          <p className="font-medium text-slate-800">
            {entry.location
              ? `${entry.location.lat.toFixed(3)}, ${entry.location.lng.toFixed(3)}`
              : "Unavailable"}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase text-slate-400">Battery</p>
          <p className="font-medium text-slate-800">
            {entry.batteryPct != null ? `${entry.batteryPct}%` : "—"}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase text-slate-400">Note</p>
          <p className="font-medium text-slate-800">
            {entry.note ?? "No note"}
          </p>
        </div>
      </div>
    </div>
  );
}
