import type { MusicMoment, MusicInsight } from "@/lib/spotify/types";

import momentsData from "./music-moments.json";
import insightsData from "./music-insights.json";

export const musicMoments: MusicMoment[] = momentsData as MusicMoment[];
export const musicInsights: MusicInsight[] = insightsData as MusicInsight[];

export function getMomentsByMonth(
  moments: MusicMoment[]
): Array<{ month: string; moments: MusicMoment[] }> {
  const grouped = new Map<string, MusicMoment[]>();
  for (const m of moments) {
    const month = m.dateRange.start.slice(0, 7);
    if (!grouped.has(month)) grouped.set(month, []);
    grouped.get(month)!.push(m);
  }
  return [...grouped.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([month, moments]) => ({
      month,
      moments: moments.sort((a, b) => b.intensity - a.intensity),
    }));
}

export function formatMonth(yearMonth: string): string {
  const [year, month] = yearMonth.split("-");
  const date = new Date(parseInt(year), parseInt(month) - 1);
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}
