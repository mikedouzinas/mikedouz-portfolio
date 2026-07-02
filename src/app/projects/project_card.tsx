"use client";
import React, { useEffect, useState } from "react";
import { FaGithub } from "react-icons/fa";
import { ExternalLink } from "lucide-react";
import { Project } from "@/data/loaders";
import Image from "next/image";
import BaseCard from "@/components/base_card";
import AskIrisButton from "@/components/AskIrisButton";

interface ProjectCardProps {
  project: Project;
}

export default function ProjectCard({ project }: ProjectCardProps) {
  // #7 — gallery support: when a project carries several images, hovering the
  // image cycles through them with a crossfade; a single image stays static.
  const images =
    project.images && project.images.length > 0
      ? project.images
      : project.imageUrl
        ? [project.imageUrl]
        : [];
  const [imageIdx, setImageIdx] = useState(0);
  const [imageHover, setImageHover] = useState(false);
  useEffect(() => {
    if (!imageHover || images.length < 2) return;
    const id = setInterval(() => setImageIdx((i) => (i + 1) % images.length), 2500);
    return () => clearInterval(id);
  }, [imageHover, images.length]);

  return (
    <BaseCard 
      href={project.githubLink}
      glowColor="99, 102, 241"  // Indigo glow for projects
      glowIntensity={0.35}
    >
      <div
        className="flex flex-col-reverse md:grid gap-x-4 items-start"
        style={{
          gridTemplateColumns: "minmax(150px, 220px) minmax(265px, 1fr)",
        }}
      >
        <div
          className="mt-6 md:mt-0"
          onMouseEnter={() => setImageHover(true)}
          onMouseLeave={() => {
            setImageHover(false);
            setImageIdx(0);
          }}
        >
          {/* Images come from projects.json: the images[] gallery (#7), falling
              back to the single links.image. Explicit width/height as required
              by the Next.js Image component. */}
          {images.length > 0 ? (
            <div className="relative">
              {images.map((src, i) => (
                <Image
                  key={src}
                  src={src}
                  alt={project.title}
                  width={400}
                  height={300}
                  className={`rounded-md object-cover w-[50%] md:w-full h-auto min-w-[150px] transition-opacity duration-500 ${
                    i === imageIdx ? 'opacity-100' : 'opacity-0 absolute inset-0'
                  }`}
                />
              ))}
              {images.length > 1 && (
                <div className="absolute bottom-1.5 left-1/2 flex -translate-x-1/2 gap-1">
                  {images.map((_, i) => (
                    <span
                      key={i}
                      className={`h-1 w-1 rounded-full transition-colors ${
                        i === imageIdx ? 'bg-white/90' : 'bg-white/40'
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="w-full h-[300px] bg-gray-200 dark:bg-gray-700 rounded-md flex items-center justify-center">
              <span className="text-gray-500 dark:text-gray-400">No image available</span>
            </div>
          )}
        </div>
        <div className="flex flex-col">
          <div className="flex flex-wrap justify-between items-start mb-1">
            {/* Full title shown on lg+ screens, short title (if available) on medium and smaller */}
            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-200 group-hover:text-blue-800 dark:group-hover:text-blue-300 min-w-0 break-words">
              {project.shortTitle ? (
                <>
                  <span className="hidden lg:inline">{project.title}</span>
                  <span className="lg:hidden">{project.shortTitle}</span>
                </>
              ) : (
                project.title
              )}
            </h3>
            {/* Action group: link arrows (GitHub / External) always visible so users
                know where the card navigates. Ask Iris button fades in on hover on desktop. */}
            <div className="flex items-center gap-2 flex-shrink-0 mb-1">
              <div className="opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-[50ms]">
                <AskIrisButton item={project} type="project" />
              </div>
              {project.githubLink && (
                <a
                  href={project.githubLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="GitHub"
                  onClick={(e) => e.stopPropagation()}
                  className="inline-block hover:scale-110 transition-transform duration-200 ease-out"
                >
                  <FaGithub className="w-5 h-5 text-blue-500 dark:text-blue-300 hover:text-blue-700 dark:hover:text-orange-500" />
                </a>
              )}
              {project.projectLink && project.projectLink.length > 0 && (
                <a
                  href={project.projectLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Live Project"
                  onClick={(e) => e.stopPropagation()}
                  className="inline-block hover:scale-110 transition-transform duration-200 ease-out"
                >
                  <ExternalLink className="w-5 h-5 text-blue-500 dark:text-blue-300 hover:text-blue-700 dark:hover:text-orange-500" />
                </a>
              )}
            </div>
          </div>
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
