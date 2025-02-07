// src/components/ExperienceCard.tsx
"use client";

import BaseCard from "@/components/base_card";
import { WorkExperience } from "@/data/workExperiences";

interface ExperienceCardProps {
  item: WorkExperience;
}

export default function ExperienceCard({ item }: ExperienceCardProps) {
  return (
    <BaseCard>
      {/* Use flex-1 instead of h-full */}
      <div className="flex flex-col flex-1">
        {/* TOP CONTENT */}
        <div>
          <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-200">
            {item.title}
          </h3>
          <div className="flex items-center text-sm my-2">
            <span className="text-blue-600 dark:text-blue-400 font-medium">
              {item.company}
            </span>
            <span className="mx-2 text-gray-500 dark:text-gray-400">•</span>
            <span className="text-gray-500 dark:text-gray-400">{item.period}</span>
          </div>
          <p className="text-sm text-gray-700 dark:text-gray-300">
            {item.description}
          </p>
        </div>

        {/* BOTTOM CONTENT pinned to bottom */}
        <div className="mt-auto pt-2">
          <div className="flex flex-wrap gap-2">
            {item.skills.map((skill) => (
              <span
                key={skill}
                className="px-3 py-1 text-xs font-semibold bg-blue-100 text-blue-800 rounded-lg"
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
