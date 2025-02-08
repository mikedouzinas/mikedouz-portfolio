"use client";
import React from "react";
import { FaGithub } from "react-icons/fa";
import { ExternalLink } from "lucide-react";
import { Project } from "@/data/projects";

interface ProjectCardProps {
  project: Project;
}

export default function ProjectCard({ project }: ProjectCardProps) {
  // Clicking anywhere on the card (except inner links) will open the GitHub URL
  const openGithub = (e: React.MouseEvent<HTMLDivElement>) => {
    window.open(project.githubLink, "_blank");
  };

  return (
    <div
      onClick={openGithub}
      role="link"
      tabIndex={0}
      className="max-w-[42rem] mx-auto w-full relative rounded-xl transition-all duration-300 ease-in-out 
        hover:shadow-lg mb-6 cursor-pointer
        hover:bg-gradient-to-br hover:from-gray-100 hover:to-gray-200 hover:bg-opacity-80 
        dark:hover:from-gray-800 dark:hover:to-gray-700 dark:hover:bg-opacity-80"
    >
      {/* Icons: Absolutely positioned in the top-right */}
      <div className="absolute top-2 right-2 flex space-x-2">
        <a
          href={project.githubLink}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="GitHub"
          onClick={(e) => e.stopPropagation()}
        >
          <FaGithub className="w-5 h-5 text-blue-500 dark:text-blue-300 hover:text-blue-700 dark:hover:text-orange-500" />
        </a>
        {project.projectLink && project.projectLink.length > 0 && (
          <a
            href={project.projectLink}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Live Project"
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink className="w-5 h-5 text-blue-500 dark:text-blue-300 hover:text-blue-700 dark:hover:text-orange-500" />
          </a>
        )}
      </div>

      {/* Inner container: limited width and padded to align with About/Experience sections */}
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="grid grid-cols-[280px,1fr] gap-x-4 items-start">
          {/* Left Column: Project Image */}
          <div>
            <img
              src={project.imageUrl}
              alt={project.title}
              className="w-[280px] h-[160px] object-cover rounded-md"
            />
          </div>
          {/* Right Column: Project Details */}
          <div className="flex flex-col">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-200 mb-2">
              {project.title}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {project.description}
            </p>
            {project.skills && (
              <div className="flex flex-wrap gap-2 mt-4">
                {project.skills.map((skill) => (
                  <span
                    key={skill}
                    className="px-3 py-1 text-xs font-semibold bg-blue-100 text-blue-800 rounded-full"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
