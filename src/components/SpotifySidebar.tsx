"use client";

import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ExternalLink } from "lucide-react";
import Image from "next/image";
import { songs } from "@/data/loaders";

/**
 * SpotifySidebar - A personal music journal in the sidebar.
 *
 * Shows a featured song with album art, expandable into a timeline
 * grouped by life period. Editorial/journal aesthetic, not a Spotify embed.
 *
 * Desktop only (hidden on mobile), matching PlaygroundButton pattern.
 */
export default function SpotifySidebar() {
  const [expanded, setExpanded] = useState(false);

  // Group songs by period, preserving chronological order
  const groupedSongs = useMemo(() => {
    const groups: { period: string; year: number; songs: typeof songs }[] = [];
    const seen = new Set<string>();

    for (const song of songs) {
      if (!seen.has(song.period)) {
        seen.add(song.period);
        groups.push({
          period: song.period,
          year: song.year,
          songs: songs.filter((s) => s.period === song.period),
        });
      }
    }

    // Most recent periods first
    return groups.sort((a, b) => b.year - a.year);
  }, []);

  // Featured song: first song from the most recent period
  const featured = groupedSongs[0]?.songs[0];

  if (!featured) return null;

  return (
    <div className="hidden md:block mb-6">
      {/* Section header */}
      <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-3 text-left">
        Soundtrack
      </p>

      {/* Featured song */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full group flex items-center gap-3 text-left transition-all duration-300 ease-in-out"
        aria-expanded={expanded}
        aria-label={expanded ? "Collapse soundtrack" : "Expand soundtrack"}
      >
        <div className="relative w-10 h-10 rounded overflow-hidden flex-shrink-0 bg-gray-200 dark:bg-gray-700">
          <Image
            src={featured.albumArt}
            alt={featured.album}
            fill
            sizes="40px"
            className="object-cover"
            onError={(e) => {
              // Hide broken image, show colored placeholder
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate leading-tight">
            {featured.title}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate leading-tight">
            {featured.artist}
          </p>
        </div>

        <motion.div
          animate={{ rotate: expanded ? 180 : 0 }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
          className="flex-shrink-0"
        >
          <ChevronDown className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500 group-hover:text-[#ff7f32] dark:group-hover:text-blue-500 transition-colors duration-300" />
        </motion.div>
      </button>

      {/* Expanded timeline */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="pt-3 space-y-4">
              {groupedSongs.map((group) => (
                <div key={group.period}>
                  {/* Period header */}
                  <p className="text-[10px] uppercase tracking-widest text-[#ff7f32] dark:text-blue-500 mb-1.5 font-medium">
                    {group.period}
                  </p>

                  {/* Songs in this period */}
                  <div className="space-y-1.5">
                    {group.songs.map((song) => (
                      <SongRow key={song.id} song={song} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SongRow({ song }: { song: (typeof songs)[number] }) {
  return (
    <a
      href={song.spotifyUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="group/song flex items-center gap-2.5 py-1 transition-all duration-300 ease-in-out rounded-sm"
      title={song.significance}
    >
      <div className="relative w-8 h-8 rounded overflow-hidden flex-shrink-0 bg-gray-200 dark:bg-gray-700">
        <Image
          src={song.albumArt}
          alt={song.album}
          fill
          sizes="32px"
          className="object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-800 dark:text-gray-200 truncate leading-tight group-hover/song:text-[#ff7f32] dark:group-hover/song:text-blue-500 transition-colors duration-300">
          {song.title}
        </p>
        <p className="text-[11px] text-gray-400 dark:text-gray-500 truncate leading-tight">
          {song.artist}
        </p>
      </div>

      <ExternalLink className="w-3 h-3 text-gray-300 dark:text-gray-600 opacity-0 group-hover/song:opacity-100 transition-opacity duration-300 flex-shrink-0" />
    </a>
  );
}
