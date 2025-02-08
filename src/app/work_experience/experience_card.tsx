"use client";
import React from "react";
import { WorkExperience } from "@/data/workExperiences";

interface ExperienceCardProps {
  item: WorkExperience;
}

export default function ExperienceCard({ item }: ExperienceCardProps) {
  return (
    <div className="max-w-[42rem] mx-auto w-full rounded-xl transition-all duration-300 ease-in-out 
  hover:shadow-lg mb-6 
  hover:bg-gradient-to-br hover:from-gray-100 hover:to-gray-200 hover:bg-opacity-80 
  dark:hover:from-gray-800 dark:hover:to-gray-700 dark:hover:bg-opacity-80">


      {/* Inner container: limited width and padded to align with About section */}
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex">
          {/* Date column (left-aligned) */}
          <div className="w-32 flex-shrink-0 pr-6 mt-2 text-xs text-gray-400">
            {item.period}
          </div>

          {/* Main content */}
          <div className="flex flex-col flex-1">
            <h3 className="text-xl">{item.title}</h3>
            <div className="mb-2 text-sm">
              <span className="text-blue-600 dark:text-blue-400">{item.company}</span>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">{item.description}</p>
            <div className="flex flex-wrap gap-2 mt-4">
              {item.skills.map((skill) => (
                <span
                  key={skill}
                  className="px-3 py-1 text-xs font-semibold bg-blue-100 text-blue-800 rounded-full"
                >
                  {skill}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
