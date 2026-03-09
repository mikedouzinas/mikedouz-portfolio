"use client";
import React from "react";
import InProgressCard from "./InProgressCard";
import type { InProgressItem } from "./InProgressCard";
import ExpandableSection from "./ExpandableSection";
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
 * On mobile: wraps cards in ExpandableSection for consistent headers,
 * "Show all" toggle, and spacing — matching normal mode exactly.
 * On desktop: renders cards directly in a spaced column.
 */
export default function InProgressSection({
  section,
  title,
  visible,
}: {
  section: keyof typeof inProgressBySection;
  title: string;
  visible: boolean;
}) {
  const items = inProgressBySection[section];

  const cards = items.map((item, i) => (
    <InProgressCard key={item.id} item={item} index={i} visible={visible} />
  ));

  return (
    <>
      <div className="md:hidden">
        <ExpandableSection title={title} items={cards} initialCount={2} />
      </div>
      <div className="hidden md:block">
        <div className="max-w-3xl mx-auto space-y-6">
          {cards}
        </div>
      </div>
    </>
  );
}
