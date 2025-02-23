"use client";
import React from "react";
import ExperienceCard from "@/app/work_experience/experience_card";
import { workExperiences } from "@/data/workExperiences";

export default function ExperienceSection() {
  return (
    <section id="experience" className="py-16 bg-gray-50 dark:bg-gray-900">
      <div className="max-w-3xl mx-auto space-y-6">
        {workExperiences.map((exp) => (
          <ExperienceCard key={exp.id} item={exp} />
        ))}
      </div>
    </section>
  );
}
