"use client";

import React from "react";
import type { MusicInsight, InsightType } from "@/lib/spotify/types";

const INSIGHT_LABELS: Record<InsightType, { label: string; color: string }> = {
  burst: { label: "Burst", color: "bg-green-500/20 text-green-400" },
  comeback: { label: "Comeback", color: "bg-blue-500/20 text-blue-400" },
  loyalty: { label: "Loyal Fav", color: "bg-purple-500/20 text-purple-400" },
  late_night: { label: "Late Night", color: "bg-indigo-500/20 text-indigo-400" },
  artist_dive: { label: "Deep Dive", color: "bg-orange-500/20 text-orange-400" },
  session_anchor: { label: "Opener", color: "bg-yellow-500/20 text-yellow-400" },
  one_and_done: { label: "One & Done", color: "bg-red-500/20 text-red-400" },
  seasonal: { label: "Seasonal", color: "bg-teal-500/20 text-teal-400" },
};

interface SpotifyAdminDetailProps {
  insight: MusicInsight;
}

export default function SpotifyAdminDetail({ insight }: SpotifyAdminDetailProps) {
  const { insightTypes, context, maxState } = insight;

  return (
    <div className="px-4 pb-4 space-y-3 border-t border-white/[0.06] pt-3">
      {/* Insight type tags */}
      {insightTypes.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {insightTypes.map((type) => {
            const { label, color } = INSIGHT_LABELS[type];
            return (
              <span
                key={type}
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${color}`}
              >
                {label}
              </span>
            );
          })}
        </div>
      )}

      {/* Context stats grid */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px]">
        <div className="flex justify-between">
          <span className="text-gray-500">Window plays</span>
          <span className="text-gray-300 font-medium">{context.totalPlaysInWindow}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Unique tracks</span>
          <span className="text-gray-300 font-medium">{context.uniqueTracksInWindow}</span>
        </div>
        {context.monthsActive != null && (
          <div className="flex justify-between">
            <span className="text-gray-500">Months active</span>
            <span className="text-gray-300 font-medium">{context.monthsActive}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-gray-500">Kleinberg state</span>
          <span className="text-gray-300 font-medium">{maxState}</span>
        </div>
      </div>
    </div>
  );
}
