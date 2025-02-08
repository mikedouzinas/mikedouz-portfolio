"use client";
import React from "react";
import { WorkExperience } from "@/data/workExperiences";

interface ExperienceCardProps {
  item: WorkExperience;
}

export default function ExperienceCard({ item }: ExperienceCardProps) {
  // Clicking anywhere on the card (except on inner links) will open the company URL
  const openCompanyUrl = (e: React.MouseEvent<HTMLDivElement>) => {
    window.open(item.companyUrl, "_blank");
  };

  return (
    <div
      onClick={openCompanyUrl}
      role="link"
      tabIndex={0}
      className="max-w-[42rem] mx-auto w-full relative rounded-xl transition-all duration-300 ease-in-out md:hover:shadow-lg mb-6 cursor-pointer md:hover:bg-gradient-to-br md:hover:from-gray-100 md:hover:to-gray-200 md:hover:bg-opacity-80 dark:md:hover:from-gray-800 dark:md:hover:to-gray-700 dark:md:hover:bg-opacity-80"
    >
      {/* Inner container: limited width and padded to align with About/Experience sections */}
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex flex-col md:flex-row">
          <div className="w-full md:w-32 flex-shrink-0 pr-0 md:pr-6 mt-2 text-xs text-gray-400 text-left md:text-left">
            {item.period}
          </div>
          {/* Main content */}
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
