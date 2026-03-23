"use client";
import React from "react";
import BaseCard from "@/components/base_card";
import AskIrisButton from "@/components/AskIrisButton";
import {
  Smartphone,
  ScanEye,
  CircleDot,
  Compass,
  Film,
  Book,
  Lamp,
  NotepadText,
  UtensilsCrossed,
  Armchair,
  ExternalLink,
  type LucideIcon,
} from "lucide-react";

export interface InProgressItem {
  id: string;
  title: string;
  shortTitle?: string;
  section: "experience" | "projects" | "media" | "blueprints";
  status: "building" | "writing" | "ongoing" | "vision" | "paused";
  summary: string;
  specifics: string[];
  parent?: string;
  role?: string;
  company?: string;
  period?: string;
  aliases?: string[];
  connections?: string[];
  skills?: string[];
  classes?: string[];
  tags?: string[];
  links?: Record<string, string>;
}

// Map item IDs to icons
const ITEM_ICONS: Record<string, LucideIcon> = {
  "iris-mobile": Smartphone,
  apollo: ScanEye,
  rankd: Smartphone,
  caliber: CircleDot,
  nexus: Compass,
  "calliope-screenplay": Film,
  tree: Book,
  lantern: Lamp,
  "important-things": NotepadText,
  tavern: UtensilsCrossed,
  "green-room": Armchair,
};

// Status → gradient for accent bar + tag styling
// Building uses a teal→cyan gradient to differentiate from the green→emerald skill pills
const STATUS_CONFIG: Record<
  InProgressItem["status"],
  { gradient: string; label: string; tagClasses: string }
> = {
  building: {
    gradient: "linear-gradient(to bottom, #14b8a6, #3b82f6)",
    label: "Building",
    tagClasses:
      "bg-gradient-to-r from-teal-100 to-blue-100 text-teal-700 dark:from-teal-900/50 dark:to-blue-900/50 dark:text-teal-400",
  },
  writing: {
    gradient: "linear-gradient(to bottom, #22c55e, #3b82f6)",
    label: "Writing",
    tagClasses:
      "bg-gradient-to-r from-green-100 to-blue-100 text-green-700 dark:from-green-900/50 dark:to-blue-900/50 dark:text-green-400",
  },
  ongoing: {
    gradient: "linear-gradient(to bottom, #3b82f6, #6366f1)",
    label: "Ongoing",
    tagClasses:
      "bg-gradient-to-r from-blue-100 to-indigo-100 text-blue-700 dark:from-blue-900/50 dark:to-indigo-900/50 dark:text-blue-400",
  },
  vision: {
    gradient: "linear-gradient(to bottom, #f59e0b, #f97316)",
    label: "Blueprint",
    tagClasses:
      "bg-gradient-to-r from-amber-100 to-orange-100 text-amber-700 dark:from-amber-900/50 dark:to-orange-900/50 dark:text-amber-400",
  },
  paused: {
    gradient: "linear-gradient(to bottom, #9ca3af, #64748b)",
    label: "Paused",
    tagClasses:
      "bg-gradient-to-r from-gray-100 to-slate-100 text-gray-600 dark:from-gray-700/50 dark:to-slate-700/50 dark:text-gray-400",
  },
};

interface InProgressCardProps {
  item: InProgressItem;
  index: number;
  visible: boolean;
}

export default function InProgressCard({ item, index, visible }: InProgressCardProps) {
  const config = STATUS_CONFIG[item.status];
  const isExperience = item.section === "experience";
  const Icon = ITEM_ICONS[item.id];
  const githubLink = item.links?.github;

  const statusTag = (
    <span
      className={`inline px-2 py-0.5 text-[10px] font-semibold uppercase rounded-full whitespace-nowrap ${config.tagClasses}`}
    >
      {config.label}
    </span>
  );

  // Gradient divider bar — used between left column and content
  const dividerBar = (
    <div
      className="w-[3px] self-stretch rounded-full flex-shrink-0"
      style={{ background: config.gradient }}
    />
  );

  return (
    <div
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(10px)",
        transition: "opacity 300ms ease-out, transform 300ms ease-out",
        transitionDelay: visible ? `${400 + index * 50}ms` : "0ms",
      }}
    >
      <BaseCard
        glowColor="34, 197, 94"
        glowIntensity={0.15}
        initial={false}
        animate={false}
        className="dark:hover:from-green-950/40 dark:hover:to-blue-950/30"
        href={githubLink}
      >
        {isExperience ? (
          /* Experience layout: [date] | bar | [content] — bar centered between columns */
          <div className="flex flex-col md:flex-row">
            <div className="w-full md:w-28 flex-shrink-0 mt-2 text-xs text-gray-400 text-left md:text-center">
              {item.period}
            </div>

            {/* Gradient divider — equal spacing via mx-4 */}
            <div
              className="hidden md:block w-[3px] self-stretch rounded-full flex-shrink-0 mx-4"
              style={{ background: config.gradient }}
            />

            <div className="flex flex-col flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <h3 className="text-xl text-gray-900 dark:text-gray-200 group-hover:text-blue-800 dark:group-hover:text-blue-300">
                  {item.role || item.title}
                </h3>
                {statusTag}
                <div className="ml-auto opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-[50ms]">
                  <AskIrisButton item={{ id: item.id, title: item.company || item.title }} type="in-progress" />
                </div>
              </div>
              <div className="mb-2 text-sm text-blue-600 dark:text-blue-400">
                {item.company}
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {item.summary}
              </p>
              {item.skills && item.skills.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-4">
                  {item.skills.map((skill) => (
                    <span
                      key={skill}
                      className="px-3 py-1 text-xs font-semibold rounded-full bg-gradient-to-r from-blue-100 to-blue-200 text-blue-800 dark:from-blue-900 dark:to-blue-700 dark:bg-opacity-50 dark:text-blue-300"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Standard layout: [icon] | bar | [content] */
          <div className="flex flex-row gap-4">
            {/* Icon column — vertically centered, hidden on mobile in deep mode */}
            {Icon && (
              <div className="hidden md:flex flex-shrink-0 items-center">
                <Icon className="w-8 h-8 text-gray-400 dark:text-gray-500" strokeWidth={1.5} />
              </div>
            )}

            {/* Gradient divider — hidden on mobile */}
            <div className="hidden md:block">{dividerBar}</div>

            {/* Content */}
            <div className="flex flex-col flex-1 min-w-0">
              {item.parent && (
                <span className="text-[11px] font-medium tracking-wide uppercase text-gray-400 dark:text-gray-500 mb-1">
                  {item.parent}
                </span>
              )}

              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <h3 className="text-xl text-gray-900 dark:text-gray-200 group-hover:text-blue-800 dark:group-hover:text-blue-300">
                  {item.shortTitle ? (
                    <>
                      <span className="md:hidden">{item.shortTitle}</span>
                      <span className="hidden md:inline">{item.title}</span>
                    </>
                  ) : item.title}
                </h3>
                {statusTag}
                <div className="ml-auto flex items-center gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-[50ms]">
                  <AskIrisButton item={{ id: item.id, title: item.title }} type="in-progress" />
                  {githubLink && (
                    <a
                      href={githubLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Project Link"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-block hover:scale-105 transition-all duration-200 ease-out"
                    >
                      <ExternalLink className="w-5 h-5 text-blue-500 dark:text-blue-300 hover:text-blue-700 dark:hover:text-orange-500" />
                    </a>
                  )}
                </div>
              </div>

              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {item.summary}
              </p>

              {item.skills && item.skills.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-4">
                  {item.skills.map((skill) => (
                    <span
                      key={skill}
                      className="px-3 py-1 text-xs font-semibold rounded-full bg-gradient-to-r from-blue-100 to-blue-200 text-blue-800 dark:from-blue-900 dark:to-blue-700 dark:bg-opacity-50 dark:text-blue-300"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </BaseCard>
    </div>
  );
}
