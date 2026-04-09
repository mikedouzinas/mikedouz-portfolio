import type { MusicMoment, MusicInsight } from "@/lib/spotify/types";

// Lazy-loaded data — not bundled into initial JS
let _moments: MusicMoment[] | null = null;
let _insights: MusicInsight[] | null = null;

export function getMusicMoments(): MusicMoment[] {
  if (!_moments) {
    // Dynamic require at runtime, not at bundle time
    _moments = require("./music-moments.json") as MusicMoment[];
  }
  return _moments;
}

export function getMusicInsights(): MusicInsight[] {
  if (!_insights) {
    _insights = require("./music-insights.json") as MusicInsight[];
  }
  return _insights;
}

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
      moments: moments.sort((a, b) =>
        a.dateRange.start.localeCompare(b.dateRange.start)
      ),
    }));
}

export function formatMonth(yearMonth: string): string {
  const [year, month] = yearMonth.split("-");
  const date = new Date(parseInt(year), parseInt(month) - 1);
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}
