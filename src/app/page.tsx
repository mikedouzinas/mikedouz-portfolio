"use client";
import React, { useRef, useState } from 'react';
import SidebarHome from './sidebar_content';
import About from './about/about_section';
import ExperienceCard from './work_experience/experience_card';
import ProjectCard from './projects/project_card';
import BlogCard from './blogs/blog_card';
import MouseGlow from '@/components/mouse_glow';
import HeaderMobile from '@/components/HeaderMobile';
import AboutSheet from '@/components/AboutSheet';
import ExpandableSection from '@/components/ExpandableSection';
import { workExperiences, projects, blogs } from '@/data/loaders';

export default function Home() {
  const mainRef = useRef<HTMLDivElement>(null);
  // State for controlling the About & Links sheet on mobile
  const [aboutSheetOpen, setAboutSheetOpen] = useState(false);

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

  // Create card arrays for expandable sections on mobile
  // These maintain the existing card designs without modification
  const experienceCards = workExperiences.map((exp) => (
    <ExperienceCard key={exp.id} item={exp} />
  ));
  
  const projectCards = projects.map((proj) => (
    <ProjectCard key={proj.id} project={proj} />
  ));
  
  const blogCards = blogs.map((blog) => (
    <BlogCard key={blog.id} blog={blog} />
  ));

  return (
    <div className="bg-gray-50 dark:bg-gray-900 min-h-screen">
      <MouseGlow />
      
      {/* Mobile sticky header - only visible below md breakpoint */}
      <HeaderMobile onOpenAbout={() => setAboutSheetOpen(true)} />
      
      {/* About & Links sheet modal for mobile */}
      <AboutSheet 
        open={aboutSheetOpen} 
        onClose={() => setAboutSheetOpen(false)} 
      />
      
      <div className="flex">
        {/* Desktop Sidebar - only visible at md breakpoint and above */}
        <aside onWheel={handleSidebarWheel} className="hidden md:block fixed inset-y-0 left-0 w-1/3">
          <SidebarHome scrollToTop={scrollToTop} />
        </aside>
        
        {/* Main Content */}
        {/* Mobile: tighter spacing (pt-2, space-y-10) | Desktop: original spacing (pt-8, space-y-16) */}
        <main ref={mainRef} className="ml-0 md:ml-[33.3333%] w-full px-4 md:px-8 pt-2 md:pt-8 pb-20 overflow-y-auto md:h-screen space-y-10 md:space-y-16">
          {/* About Section - Hidden on mobile (available via AboutSheet), visible on desktop */}
          <section id="about" className="hidden md:block md:mt-16">
            <About />
          </section>
          
          {/* Experience Section - expandable on mobile, full list on desktop */}
          <section id="experience" className="md:mt-32">
            {/* Mobile: ExpandableSection wrapper with collapsible behavior */}
            <div className="md:hidden">
              <ExpandableSection 
                title="Experience" 
                items={experienceCards}
                initialCount={2}
              />
            </div>
            
            {/* Desktop: Full list without collapsing */}
            <div className="hidden md:block">
              <div className="max-w-3xl mx-auto space-y-6">
                {experienceCards}
              </div>
            </div>
          </section>
          
          {/* Projects Section - expandable on mobile, full list on desktop */}
          <section id="projects" className="md:mt-32">
            {/* Mobile: ExpandableSection wrapper with collapsible behavior */}
            <div className="md:hidden">
              <ExpandableSection 
                title="Projects" 
                items={projectCards}
                initialCount={2}
              />
            </div>
            
            {/* Desktop: Full list without collapsing */}
            <div className="hidden md:block">
              <div className="max-w-3xl mx-auto space-y-6">
                {projectCards}
              </div>
            </div>
          </section>
          
          {/* Blogs Section - expandable on mobile, full list on desktop */}
          <section id="blogs" className="md:mt-32">
            {/* Mobile: ExpandableSection wrapper with collapsible behavior */}
            <div className="md:hidden">
              <ExpandableSection 
                title="Blogs" 
                items={blogCards}
                initialCount={2}
              />
            </div>
            
            {/* Desktop: Full list without collapsing */}
            <div className="hidden md:block">
              <div className="max-w-3xl mx-auto space-y-6">
                {blogCards}
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
