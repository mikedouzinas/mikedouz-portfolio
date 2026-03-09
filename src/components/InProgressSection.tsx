"use client";
import React from "react";
import InProgressCard from "./InProgressCard";
import type { InProgressItem } from "./InProgressCard";
import inProgressData from "@/data/deep/in-progress.json";

// Status sort order: building/writing first, then ongoing, vision, paused
const STATUS_ORDER: Record<string, number> = {
  building: 0,
  writing: 1,
  ongoing: 2,
  vision: 3,
  paused: 4,
};

const allItems: InProgressItem[] = (inProgressData as InProgressItem[]).sort(
  (a, b) => (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99)
);

/** Pre-filtered item lists by section */
export const inProgressBySection = {
  experience: allItems.filter((i) => i.section === "experience"),
  projects: allItems.filter((i) => i.section === "projects"),
  media: allItems.filter((i) => i.section === "media"),
  blueprints: allItems.filter((i) => i.section === "blueprints"),
};

/**
 * Renders a list of in-progress cards for a given section.
 * Used inside each section's deep-mode branch in page.tsx.
 */
export default function InProgressSection({
  section,
  visible,
}: {
  section: keyof typeof inProgressBySection;
  visible: boolean;
}) {
  const items = inProgressBySection[section];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {items.map((item, i) => (
        <InProgressCard key={item.id} item={item} index={i} visible={visible} />
      ))}
    </div>
  );
}
