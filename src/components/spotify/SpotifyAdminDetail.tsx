"use client";

import React, { useState } from "react";
import { Info } from "lucide-react";
import type { MusicInsight, InsightType } from "@/lib/spotify/types";

const INSIGHT_LABELS: Record<InsightType, { label: string; color: string; description: string }> = {
  burst: {
    label: "Burst",
    color: "bg-green-500/20 text-green-400",
    description: "A concentrated period of heavy listening detected by the algorithm",
  },
  comeback: {
    label: "Comeback",
    color: "bg-blue-500/20 text-blue-400",
    description: "This song had multiple distinct listening peaks — it came back after a gap",
  },
  loyalty: {
    label: "Loyal Fav",
    color: "bg-purple-500/20 text-purple-400",
    description: "50+ total plays across 4+ months — a consistent favorite, not just a phase",
  },
  late_night: {
    label: "Late Night",
    color: "bg-indigo-500/20 text-indigo-400",
    description: "Majority of plays happened between midnight and 4am",
  },
  artist_dive: {
    label: "Deep Dive",
    color: "bg-orange-500/20 text-orange-400",
    description: "Part of a period where you explored this artist's full catalog",
  },
  session_anchor: {
    label: "Opener",
    color: "bg-yellow-500/20 text-yellow-400",
    description: "Frequently the first song you manually played in a session",
  },
  one_and_done: {
    label: "One & Done",
    color: "bg-red-500/20 text-red-400",
    description: "Intense burst followed by silence — you moved on completely after this",
  },
  seasonal: {
    label: "Seasonal",
    color: "bg-teal-500/20 text-teal-400",
    description: "This song spikes around the same time of year across multiple years",
  },
};

const STATE_LABELS: Record<number, { label: string; description: string }> = {
  1: { label: "Elevated", description: "Above your normal listening rate for this track" },
  2: { label: "Burst", description: "Significantly above normal — a real moment" },
  3: { label: "Intense", description: "Peak intensity — this song dominated your listening" },
};

interface SpotifyAdminDetailProps {
  insight: MusicInsight;
}

function Tooltip({ text, children }: { text: string; children: React.ReactNode }) {
  const [show, setShow] = useState(false);

  return (
    <span
      className="relative inline-flex items-center"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && (
        <span className="absolute bottom-full left-0 mb-1.5 w-48 p-2 rounded-lg bg-gray-900 border border-white/10 text-[10px] text-gray-300 leading-tight shadow-xl z-20">
          {text}
        </span>
      )}
    </span>
  );
}

export default function SpotifyAdminDetail({ insight }: SpotifyAdminDetailProps) {
  const { insightTypes, context, maxState, peakDay, peakDayPlays } = insight;
  const stateInfo = STATE_LABELS[maxState];

  // Format peak day nicely
  const peakDate = peakDay
    ? new Date(peakDay).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })
    : null;

  // Listening share: this track's plays / total plays in window
  const listeningShare = context.totalPlaysInWindow > 0
    ? ((insight.playCount / context.totalPlaysInWindow) * 100).toFixed(1)
    : null;

  return (
    <div className="space-y-2.5 border-t border-white/[0.06] pt-2.5">
      {/* Peak day highlight */}
      {peakDate && peakDayPlays > 1 && (
        <div className="flex items-center gap-2 text-[11px]">
          <span className="text-gray-500">Peak day:</span>
          <span className="font-bold text-gray-100">{peakDate}</span>
          <span className="text-gray-400">({peakDayPlays} plays)</span>
        </div>
      )}

      {/* Insight tags with hover descriptions */}
      {insightTypes.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {insightTypes.map((type) => {
            const { label, color, description } = INSIGHT_LABELS[type];
            return (
              <Tooltip key={type} text={description}>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium cursor-help ${color}`}>
                  {label}
                  <Info className="w-2.5 h-2.5 opacity-50" />
                </span>
              </Tooltip>
            );
          })}
        </div>
      )}

      {/* Context with readable labels */}
      <div className="space-y-1 text-[11px]">
        {stateInfo && (
          <div className="flex items-center gap-2">
            <Tooltip text={stateInfo.description}>
              <span className="text-gray-500 cursor-help flex items-center gap-1">
                Detection level <Info className="w-2.5 h-2.5 opacity-40" />
              </span>
            </Tooltip>
            <span className="text-gray-200 font-medium">{stateInfo.label}</span>
          </div>
        )}

        {listeningShare && (
          <div className="flex items-center gap-2">
            <Tooltip text="What percentage of all your listening during this period was this song">
              <span className="text-gray-500 cursor-help flex items-center gap-1">
                Listening share <Info className="w-2.5 h-2.5 opacity-40" />
              </span>
            </Tooltip>
            <span className="text-gray-200 font-medium">{listeningShare}%</span>
          </div>
        )}

        <div className="flex items-center gap-2">
          <Tooltip text="How many other songs you were also playing during this same period">
            <span className="text-gray-500 cursor-help flex items-center gap-1">
              Also playing <Info className="w-2.5 h-2.5 opacity-40" />
            </span>
          </Tooltip>
          <span className="text-gray-200 font-medium">
            {context.uniqueTracksInWindow} other songs
          </span>
        </div>

        {context.monthsActive != null && context.monthsActive > 1 && (
          <div className="flex items-center gap-2">
            <Tooltip text="Total months across your listening history where this song appears">
              <span className="text-gray-500 cursor-help flex items-center gap-1">
                In your library <Info className="w-2.5 h-2.5 opacity-40" />
              </span>
            </Tooltip>
            <span className="text-gray-200 font-medium">{context.monthsActive} months</span>
          </div>
        )}
      </div>
    </div>
  );
}
