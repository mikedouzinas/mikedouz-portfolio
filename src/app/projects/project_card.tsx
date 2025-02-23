"use client";
import React, { useEffect, useRef, useState } from "react";
import { FaGithub } from "react-icons/fa";
import { ExternalLink } from "lucide-react";
import { Project } from "@/data/projects";
import Image from "next/image";
import BaseCard from "@/components/base_card";

interface ProjectCardProps {
  project: Project;
}

export default function ProjectCard({ project }: ProjectCardProps) {
  return (
    <BaseCard href={project.githubLink}>
      <div className="absolute top-2 right-2 flex space-x-2">
        <a
          href={project.githubLink}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="GitHub"
          onClick={(e) => e.stopPropagation()}
        >
          <FaGithub className="w-5 h-5 text-blue-500 dark:text-blue-300 mt-5 hover:text-blue-700 dark:hover:text-orange-500" />
        </a>
        {project.projectLink && project.projectLink.length > 0 && (
          <a
            href={project.projectLink}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Live Project"
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink className="w-5 h-5 text-blue-500 dark:text-blue-300 mt-5 hover:text-blue-700 dark:hover:text-orange-500" />
          </a>
        )}
      </div>
      <div
        className="flex flex-col-reverse md:grid gap-x-4 items-start"
        style={{
          gridTemplateColumns: "minmax(150px, 220px) minmax(265px, 1fr)",
        }}
      >
        <div className="mt-6 md:mt-0">
          <Image
            src={project.imageUrl || "/path/to/default/image.jpg"}
            alt={project.title}
            width={400}
            height={300}
            className="rounded-md object-cover w-full h-auto min-w-[150px]"
          />
        </div>
        <div className="flex flex-col">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-200 mb-2">
            {project.title}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {project.description}
          </p>
          {project.skills && (
            <div className="flex flex-wrap gap-1 sm:gap-2 mt-4">
              {project.skills.map((skill) => (
                <span
                  key={skill}
                  className="px-2 sm:px-3 py-0.5 sm:py-1 text-[10px] sm:text-xs font-semibold rounded-full bg-gradient-to-r from-blue-100 to-blue-200 text-blue-800 dark:bg-gradient-to-r dark:from-blue-900 dark:to-blue-700 dark:bg-opacity-50 dark:text-blue-300"
                >
                  {skill}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </BaseCard>
  );
}
