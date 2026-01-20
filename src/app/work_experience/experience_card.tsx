"use client";
import React from "react";
import { WorkExperience } from "@/data/loaders";
import BaseCard from "@/components/base_card";
import AskIrisButton from "@/components/AskIrisButton";

interface ExperienceCardProps {
  item: WorkExperience;
}

export default function ExperienceCard({ item }: ExperienceCardProps) {
  return (
    <BaseCard href={item.companyUrl}>
      <div className="flex flex-col md:flex-row">
        <div className="w-full md:w-32 flex-shrink-0 pr-0 md:pr-6 mt-2 text-xs text-gray-400 text-left md:text-left">
          {item.period}
        </div>
        <div className="flex flex-col flex-1">
          <div className="flex flex-wrap justify-between items-start gap-x-2 gap-y-3">
            {/* Full title shown on lg+ screens, short role title on medium and smaller */}
            <h3 className="text-xl text-gray-900 dark:text-gray-200 group-hover:text-blue-800 dark:group-hover:text-blue-300 min-w-0 break-words">
              <span className="hidden lg:inline">{item.title}</span>
              <span className="lg:hidden">{item.shortTitle}</span>
            </h3>
            {/* Action button: hidden on desktop idle, fade in on hover; always visible on mobile */}
            <div className="flex-shrink-0 mb-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-[50ms]">
              <AskIrisButton item={item} type="experience" />
            </div>
          </div>
          <div className="mb-2 text-sm flex items-center gap-2">
            <a
              href={item.companyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 dark:text-blue-400 hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {item.company}
            </a>
            {item.isIncoming && (
              <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-gradient-to-r from-green-100 to-emerald-200 text-green-800 dark:from-green-900 dark:to-emerald-800 dark:text-green-300">
                Incoming
              </span>
            )}
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {item.description}
          </p>
          <div className="flex flex-wrap gap-2 mt-4">
            {item.skills.map((skill) => (
              <span
                key={skill}
                className="px-3 py-1 text-xs font-semibold rounded-full bg-gradient-to-r from-blue-100 to-blue-200 text-blue-800 dark:bg-gradient-to-r dark:from-blue-900 dark:to-blue-700 dark:bg-opacity-50 dark:text-blue-300"
              >
                {skill}
              </span>
            ))}
          </div>
        </div>
      </div>
    </BaseCard>
  );
}
