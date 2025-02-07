// src/components/ProjectCard.tsx
"use client";

import BaseCard from "@/components/base_card";
import { FaGithub } from "react-icons/fa";
import { ExternalLink } from "lucide-react";
import { Project } from "@/data/projects";

interface ProjectCardProps {
  project: Project;
}

export default function ProjectCard({ project }: ProjectCardProps) {
  return (
    <BaseCard>
      {/* We wrap everything in another flex-col that consumes the full height */}
      <div className="flex flex-col h-full">
        {/* ICONS: Absolutely position them if you like them in the top-right corner */}
        <div className="absolute top-2 right-2 flex space-x-2">
          <a
            href={project.githubLink}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="GitHub"
          >
            <FaGithub className="w-5 h-5 text-blue-500 dark:text-blue-300 hover:text-blue-700 dark:hover:text-orange-500" />
          </a>
          {project.projectLink && project.projectLink.length > 0 && (
            <a
              href={project.projectLink}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Live Project"
            >
              <ExternalLink className="w-5 h-5 text-blue-500 dark:text-blue-300 hover:text-blue-700 dark:hover:text-orange-500" />
            </a>
          )}
        </div>

        {/* TOP CONTENT: pinned to the top */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-200 mb-2">
            {project.title}
          </h3>
          <p className="text-sm text-gray-700 dark:text-gray-300">
            {project.description}
          </p>
        </div>

        {/* BOTTOM CONTENT: pinned to bottom using `mt-auto` */}
        {project.skills && (
          <div className="mt-auto pt-2">
            <div className="flex flex-wrap gap-2">
              {project.skills.map((skill) => (
                <span
                  key={skill}
                  className="px-3 py-1 text-xs font-semibold bg-blue-100 text-blue-800 rounded-full"
                >
                  {skill}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </BaseCard>
  );
}
