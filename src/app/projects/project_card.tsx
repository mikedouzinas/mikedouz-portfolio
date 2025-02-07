"use client";

import { motion } from "framer-motion";
import { FaGithub } from "react-icons/fa";
import { Project } from "@/data/projects";
import { ExternalLink } from "lucide-react";

interface ProjectCardProps {
  project: Project;
}

export default function ProjectCard({ project }: ProjectCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3 }}
      className="relative p-4 rounded-lg bg-white shadow-md border border-gray-200 hover:shadow-lg hover:border-blue-300 transition-all ease-in-out"
    >
      {/* Top Right Icon Group */}
      <div className="absolute top-2 right-2 flex space-x-2">
        <a
          href={project.githubLink}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="GitHub"
        >
          <FaGithub className="w-5 h-5 text-blue-500 hover:text-blue-700" />
        </a>
        {project.projectLink && project.projectLink.length > 0 && (
          <a
            href={project.projectLink}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Live Project"
          >
            <ExternalLink className="w-5 h-5 text-blue-500 hover:text-blue-700" />
          </a>
        )}
      </div>

      {/* Project Title */}
      <h3 className="text-lg font-semibold text-gray-900 mb-2">
        {project.title}
      </h3>

      {/* Description */}
      <p className="text-sm text-gray-700 mb-4">{project.description}</p>

      {/* Skills (tags) */}
      {project.skills && (
        <div className="flex flex-wrap gap-2 mt-2">
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
    </motion.div>
  );
}
