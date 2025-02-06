// src/components/ExperienceCard.tsx
"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { WorkExperience } from "@/data/workExperiences";

interface ExperienceCardProps {
  item: WorkExperience;
}

export default function ExperienceCard({ item }: ExperienceCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col p-6 rounded-lg bg-white shadow-md border border-gray-200 hover:shadow-xl hover:border-blue-300 transition-all ease-in-out"
      style={{ maxWidth: "800px" , maxHeight: "300px"}}
    >
       <div className="relative w-[300px] h-[150px] mx-auto mb-4">
        <Image
          src={item.imageUrl}
          alt={`${item.company} logo`}
          fill
          className="rounded-md object-contain"
        />
      </div>
      {/* Top Row: Title + Period/ */}
      <div className="flex flex-col gap-2 mb-4">
        <h3 className="text-xl font-semibold text-gray-900">{item.title}</h3>
        <div className="flex items-center text-sm text-gray-500 justify-between">
          <p>{item.period}</p>
        </div>
      </div>


      {/* Description
      <p className="text-sm text-gray-600 mb-4 leading-relaxed">
        {item.description}
      </p> */}

      {/* Skills (tags) */}
      <div className="flex flex-wrap gap-2">
        {item.skills.map((skill) => (
          <span
            key={skill}
            className="px-3 py-1 text-xs font-semibold bg-blue-100 text-blue-800 rounded-full"
          >
            {skill}
          </span>
        ))}
      </div>
    </motion.div>
  );
}
