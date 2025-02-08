"use client";
import React, { useState, useRef } from 'react';
import HomeSection from './home'; // Your full-screen landing home component
import SidebarHome from './sidebar_content'; // The sidebar component for the split view
import About from './about/about_section';
import Experience from './work_experience/work_experiences';
import Projects from './projects/projects';
import ThemeToggle from '@/components/theme_toggle';
  
export default function Home() {
  const [layout, setLayout] = useState<'landing' | 'split'>('landing');
  const mainRef = useRef<HTMLDivElement>(null);

  const handleSeeMore = () => {
    setLayout('split');
  };

  // When scrolling over the sidebar, scroll the main container
  const handleSidebarWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (mainRef.current) {
      mainRef.current.scrollBy({ top: e.deltaY, behavior: 'auto' });
    }
  };

  return (
    <div className="bg-gray-50 dark:bg-gray-900 min-h-screen">
      {layout === 'landing' ? (
        <div className="relative">
          <HomeSection onSeeMore={handleSeeMore} />
          <ThemeToggle />
        </div>
      ) : (
        <div className="flex">
          {/* Attach the onWheel handler to the sidebar */}
          <aside onWheel={handleSidebarWheel} className="fixed inset-y-0 left-0 w-1/3">
            <SidebarHome />
          </aside>
          {/* Attach the ref to the main container */}
          <main ref={mainRef} className="ml-[33.3333%] w-full p-8 overflow-y-auto h-screen">
            <section id="about">
              <About />
            </section>
            <section id="experience" className="mt-16">
              <Experience />
            </section>
            <section id="projects" className="mt-16">
              <Projects />
            </section>
            <ThemeToggle />
          </main>
        </div>
      )}
    </div>
  );
}
