"use client";

import { deleteTrack } from "./actions";
import { useState } from "react";

export function DeleteTrackButton({ trackId }: { trackId: string }) {
  const [isDeleting, setIsDeleting] = useState(false);

  return (
    <button
      disabled={isDeleting}
      onClick={async () => {
        if (confirm("Are you absolutely sure you want to delete this track? This action cannot be undone.")) {
          setIsDeleting(true);
          const res = await deleteTrack(trackId);
          if (res?.error) {
            alert(res.error);
            setIsDeleting(false);
          }
        }
      }}
      className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-bold rounded-lg transition disabled:opacity-50"
    >
      {isDeleting ? "Deleting..." : "Delete Track"}
    </button>
  );
}
