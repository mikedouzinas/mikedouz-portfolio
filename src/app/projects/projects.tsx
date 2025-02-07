// src/app/projects/projects.tsx
"use client";

import Carousel from "@/components/carousel";
import ProjectCard from "@/app/projects/project_card";
import { projects } from "@/data/projects";

export default function ProjectsSection() {
  return (
    <Carousel
      sectionId="projects"
      sectionTitle="Projects"
      items={projects}
      itemsPerPage={2}
      // We can pass either a function or inline arrow function:
      renderItem={(proj) => <ProjectCard key={proj.id} project={proj} />}
    />
  );
}
