"use client";
import React, { useEffect, useRef, useState } from "react";
import { FaGithub } from "react-icons/fa";
import { ExternalLink } from "lucide-react";
import { Project } from "@/data/projects";
import Image from "next/image";

interface ProjectCardProps {
  project: Project;
}

export default function ProjectCard({ project }: ProjectCardProps) {
  const [imageWidth, setImageWidth] = useState(280);
  const textRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const checkTextLines = () => {
      if (textRef.current) {
        const computedStyle = window.getComputedStyle(textRef.current);
        const lineHeight = parseFloat(computedStyle.lineHeight);
        const textHeight = textRef.current.clientHeight;
        const lines = textHeight / lineHeight;
        // If text wraps more than 5 lines, shrink the image column
        setImageWidth(lines > 7 ? 200 : 280);
      }
    };

    checkTextLines();
    window.addEventListener("resize", checkTextLines);
    return () => window.removeEventListener("resize", checkTextLines);
  }, [project.description]);

  return (
    <div
      onClick={() => window.open(project.githubLink, "_blank")}
      role="link"
      tabIndex={0}
      className="max-w-[42rem] mx-auto w-full relative rounded-xl transition-all duration-300 ease-in-out md:hover:shadow-lg mb-6 cursor-pointer md:hover:bg-gradient-to-br md:hover:from-gray-100 md:hover:to-gray-200 md:hover:bg-opacity-80 dark:md:hover:from-gray-800 dark:md:hover:to-gray-700 dark:md:hover:bg-opacity-80"
    >
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
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div
          className="flex flex-col-reverse md:grid gap-x-4 items-start"
          style={{
            gridTemplateColumns: `minmax(0, ${imageWidth}px) 1fr`,
          }}
        >
          <div className="mt-6 md:mt-0">
            <Image
              src={project.imageUrl || "/path/to/default/image.jpg"}
              alt={project.title}
              width={400}
              height={300}
              className="rounded-md object-cover"
            />
          </div>
          <div className="flex flex-col" ref={textRef}>
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
