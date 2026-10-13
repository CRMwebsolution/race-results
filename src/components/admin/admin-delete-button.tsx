"use client";

import { useState, useTransition } from "react";
import { Trash2, AlertTriangle, X, Loader2 } from "lucide-react";
import {
  adminDeleteEventAction,
  adminDeleteTrackAction,
  adminDeleteSeriesAction,
  adminDeleteOrganizationAction,
  adminDeleteAccountAction,
} from "@/app/admin/actions";

interface AdminDeleteButtonProps {
  itemType: "account" | "organization" | "track" | "series" | "event";
  itemId: string;
  expectedName: string;
  itemLabel?: string;
  buttonLabel?: string;
  size?: "sm" | "md";
}

export function AdminDeleteButton({
  itemType,
  itemId,
  expectedName,
  itemLabel,
  buttonLabel = "Delete",
  size = "md",
}: AdminDeleteButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [typedName, setTypedName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isMatch = typedName.trim().toLowerCase() === expectedName.trim().toLowerCase();

  const handleOpen = () => {
    setTypedName("");
    setError(null);
    setIsOpen(true);
  };

  const handleClose = () => {
    if (isPending) return;
    setIsOpen(false);
    setTypedName("");
    setError(null);
  };

  const handleDelete = () => {
    if (!isMatch || isPending) return;
    setError(null);

    startTransition(async () => {
      try {
        if (itemType === "event") {
          await adminDeleteEventAction(itemId, typedName);
        } else if (itemType === "track") {
          await adminDeleteTrackAction(itemId, typedName);
        } else if (itemType === "series") {
          await adminDeleteSeriesAction(itemId, typedName);
        } else if (itemType === "organization") {
          await adminDeleteOrganizationAction(itemId, typedName);
        } else if (itemType === "account") {
          await adminDeleteAccountAction(itemId, typedName);
        }
        setIsOpen(false);
      } catch (err: any) {
        setError(err?.message || "Failed to delete item. Please check requirements and try again.");
      }
    });
  };

  const warnings: Record<string, string> = {
    account:
      "Permanently cascade-deletes this promoter account, its profile, authentication credentials, and all organizations owned exclusively by this account.",
    organization:
      "Permanently cascade-deletes this organization along with all its affiliated tracks, series, events, classes, and official results.",
    track:
      "Permanently cascade-deletes this track, all its scheduled and completed events, templates, classes, contestants, and results.",
    series:
      "Permanently cascade-deletes this series, all its events, classes, seasons, and championship points rules.",
    event:
      "Permanently cascade-deletes this event, all classes, contestants, attempts, scoring data, and official result snapshots.",
  };

  const typeDisplayNames: Record<string, string> = {
    account: "Account",
    organization: "Organization",
    track: "Track",
    series: "Series",
    event: "Event",
  };

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className={`inline-flex items-center gap-1.5 font-bold rounded-lg transition border text-rose-400 bg-rose-950/40 border-rose-800/80 hover:bg-rose-900/60 hover:text-rose-200 ${
          size === "sm" ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-xs sm:text-sm"
        }`}
        title={`Permanently delete this ${itemType}`}
      >
        <Trash2 className="w-3.5 h-3.5" />
        <span>{buttonLabel}</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div
            className="bg-slate-900 border border-rose-900/80 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative space-y-5"
            role="dialog"
            aria-modal="true"
          >
            <button
              onClick={handleClose}
              disabled={isPending}
              className="absolute top-4 right-4 text-slate-400 hover:text-white transition disabled:opacity-50"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-3 text-rose-500">
              <div className="p-2.5 rounded-xl bg-rose-950/80 border border-rose-800/50">
                <AlertTriangle className="w-6 h-6 text-rose-400" />
              </div>
              <div>
                <h3 className="text-lg font-extrabold text-white">
                  Permanently Delete {typeDisplayNames[itemType]}
                </h3>
                <p className="text-xs text-rose-400 font-semibold tracking-wide uppercase">
                  Irreversible Cascade Action
                </p>
              </div>
            </div>

            <div className="text-sm text-slate-300 space-y-2">
              <p>
                You are about to delete {itemLabel ? <strong>{itemLabel}</strong> : "this item"}:
              </p>
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl font-mono text-sm text-amber-400 break-all select-all">
                {expectedName}
              </div>
              <p className="text-xs text-slate-400 leading-relaxed pt-1">
                {warnings[itemType]}
              </p>
            </div>

            {error && (
              <div className="p-3 bg-red-950/80 border border-red-800 rounded-xl text-red-300 text-xs font-medium">
                {error}
              </div>
            )}

            <div className="space-y-2 pt-1 border-t border-slate-800">
              <label className="block text-xs font-semibold text-slate-300">
                To confirm deletion, type <span className="text-white underline">{expectedName}</span> below:
              </label>
              <input
                type="text"
                value={typedName}
                onChange={(e) => setTypedName(e.target.value)}
                placeholder={expectedName}
                disabled={isPending}
                autoFocus
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
              />
              {!isMatch && typedName.length > 0 && (
                <p className="text-xs text-rose-400">
                  Name does not match yet. Please type the exact name to enable deletion.
                </p>
              )}
            </div>

            <div className="flex items-center justify-end space-x-3 pt-3">
              <button
                type="button"
                onClick={handleClose}
                disabled={isPending}
                className="px-4 py-2 rounded-xl text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={!isMatch || isPending}
                className="px-4 py-2 rounded-xl text-sm font-bold flex items-center space-x-2 transition disabled:opacity-40 disabled:cursor-not-allowed bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-950"
              >
                {isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Delete {typeDisplayNames[itemType]}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
