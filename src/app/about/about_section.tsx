"use client";

import AboutContent from '@/components/AboutContent';

export default function AboutSection() {
  return (
    <section
      id="about"
      className="min-h-[30vh] py-4 bg-gray-50 dark:bg-gray-900 flex flex-col items-center"
    >
      <div className="max-w-[42rem] mx-auto w-full relative">
        <div className="max-w-2xl mx-auto px-4">
          <AboutContent 
            expanded={true}
            textClassName="text-md font-light text-gray-600 dark:text-gray-400"
          />

        </div>
      </div>
    </section>
  );
}
