// src/app/work_experience/work_experiences.tsx
"use client";

import Carousel from "@/components/carousel";
import ExperienceCard from "@/app/work_experience/experience_card";
import { workExperiences } from "@/data/workExperiences";

export default function ExperienceGallery() {
  return (
    <Carousel
      sectionId="experience"
      sectionTitle="Work Experience"
      items={workExperiences}
      itemsPerPage={2}
      renderItem={(exp) => <ExperienceCard key={exp.id} item={exp} />}
    />
  );
}
