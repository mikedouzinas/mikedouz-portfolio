"use client";
import React from "react";
import { WorkExperience } from "@/data/workExperiences";
import BaseCard from "@/components/base_card";

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
          <h3 className="text-xl">{item.title}</h3>
          <div className="mb-2 text-sm">
            <a
              href={item.companyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 dark:text-blue-400 hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {item.company}
            </a>
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
