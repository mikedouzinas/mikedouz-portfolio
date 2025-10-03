"use client";
import React, { useRef } from 'react';
import SidebarHome from './sidebar_content';
import About from './about/about_section';
import Experience from './work_experience/work_experiences';
import Projects from './projects/projects';
import Blogs from './blogs/blogs_section';
import MouseGlow from '@/components/mouse_glow';

export default function Home() {
  const mainRef = useRef<HTMLDivElement>(null);

  // When scrolling over the sidebar, scroll the main container
  const handleSidebarWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (mainRef.current) {
      mainRef.current.scrollBy({ top: e.deltaY, behavior: 'auto' });
    }
  };

  // Add this function to pass to SidebarHome
  const scrollToTop = () => {
    if (mainRef.current) {
      mainRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <div className="bg-gray-50 dark:bg-gray-900 min-h-screen">
      <MouseGlow />
      <div className="flex">
        {/* Desktop Sidebar */}
        <aside onWheel={handleSidebarWheel} className="hidden md:block fixed inset-y-0 left-0 w-1/3">
          <SidebarHome scrollToTop={scrollToTop} />
        </aside>
        {/* Main Content */}
        <main ref={mainRef} className="ml-0 md:ml-[33.3333%] w-full p-8 overflow-y-auto md:h-screen">
          {/* Mobile Header: visible only on small screens */}
          <div className="md:hidden mb-4">
            <SidebarHome scrollToTop={scrollToTop} />
          </div>
          <section id="about" className="mt-16">
            <About />
          </section>
          <section id="experience" className="mt-16">
            <Experience />
          </section>
          <section id="projects" className="mt-16">
            <Projects />
          </section>
          <section id="blogs" className="mt-16">
            <Blogs />
          </section>
        </main>
      </div>
    </div>
  );
}
