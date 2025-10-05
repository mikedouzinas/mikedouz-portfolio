"use client";
import React from "react";
import ProjectCard from "@/app/projects/project_card";
import { projects } from "@/data/projects";

export default function ProjectsSection() {
  return (
    <section id="projects" className="bg-gray-50 dark:bg-gray-900">
      <div className="max-w-3xl mx-auto space-y-6">
        {projects.map((proj) => (
          <ProjectCard key={proj.id} project={proj} />
        ))}
      </div>
    </section>
  );
}
