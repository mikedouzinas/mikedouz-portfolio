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
import { DeepModeProvider, useDeepMode } from '@/components/DeepModeContext';
import DeepModeBorder from '@/components/DeepModeBorder';
import ExpandableSection from '@/components/ExpandableSection';
import InProgressSection from '@/components/InProgressSection';
import { workExperiences, projects, blogs } from '@/data/loaders';

/**
 * Inner component that consumes DeepModeContext.
 * Separated from Home so useDeepMode() is called inside DeepModeProvider.
 */
function HomeContent() {
  const mainRef = useRef<HTMLDivElement>(null);
  const [aboutSheetOpen, setAboutSheetOpen] = useState(false);
  const { deepMode, toggleDeepMode } = useDeepMode();

  const handleSidebarWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (mainRef.current) {
      mainRef.current.scrollBy({ top: e.deltaY, behavior: 'auto' });
    }
  };

  const scrollToTop = () => {
    if (mainRef.current) {
      mainRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

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
      <DeepModeBorder />

      <HeaderMobile onOpenAbout={() => setAboutSheetOpen(true)} onToggleDeepMode={toggleDeepMode} />

      <AboutSheet
        open={aboutSheetOpen}
        onClose={() => setAboutSheetOpen(false)}
      />

      <div className="flex">
        <aside onWheel={handleSidebarWheel} className="hidden md:block fixed inset-y-0 left-0 w-1/3">
          <SidebarHome scrollToTop={scrollToTop} />
        </aside>

        <main ref={mainRef} className="ml-0 md:ml-[33.3333%] w-full px-4 md:px-8 pt-1 md:pt-8 pb-20 overflow-y-auto md:h-screen space-y-6 md:space-y-32">
          {/* About Section */}
          <section id="about" className="hidden md:block md:mt-16">
            <About />
          </section>

          {/* Experience Section */}
          <section id="experience" className="md:mt-32">
            {/* Deep mode: in-progress experience items */}
            <div
              style={{
                height: deepMode ? 'auto' : '0',
                overflow: deepMode ? 'visible' : 'hidden',
                margin: deepMode ? undefined : '0',
              }}
            >
              <InProgressSection section="experience" title="Experience" visible={deepMode} />
            </div>

            {/* Regular: standard experience cards */}
            <div
              style={{
                height: deepMode ? '0' : 'auto',
                overflow: deepMode ? 'hidden' : 'visible',
                margin: deepMode ? '0' : undefined,
              }}
            >
              <div className="md:hidden">
                <ExpandableSection
                  title="Experience"
                  items={experienceCards}
                  initialCount={2}
                />
              </div>
              <div className="hidden md:block">
                <div className="max-w-3xl mx-auto space-y-6">
                  {experienceCards}
                </div>
              </div>
            </div>
          </section>

          {/* Projects Section */}
          <section id="projects" className="md:mt-32">
            {/* Deep mode: in-progress project items */}
            <div
              style={{
                height: deepMode ? 'auto' : '0',
                overflow: deepMode ? 'visible' : 'hidden',
                margin: deepMode ? undefined : '0',
              }}
            >
              <InProgressSection section="projects" title="Projects" visible={deepMode} />
            </div>

            {/* Regular: standard project cards */}
            <div
              style={{
                height: deepMode ? '0' : 'auto',
                overflow: deepMode ? 'hidden' : 'visible',
                margin: deepMode ? '0' : undefined,
              }}
            >
              <div className="md:hidden">
                <ExpandableSection
                  title="Projects"
                  items={projectCards}
                  initialCount={2}
                />
              </div>
              <div className="hidden md:block">
                <div className="max-w-3xl mx-auto space-y-6">
                  {projectCards}
                </div>
              </div>
            </div>
          </section>

          {/* Media Section */}
          <section id="media" className="md:mt-32">
            {/* Deep mode: in-progress media items */}
            <div
              style={{
                height: deepMode ? 'auto' : '0',
                overflow: deepMode ? 'visible' : 'hidden',
                margin: deepMode ? undefined : '0',
              }}
            >
              <InProgressSection section="media" title="Media" visible={deepMode} />
            </div>

            {/* Regular: standard blog/media cards */}
            <div
              style={{
                height: deepMode ? '0' : 'auto',
                overflow: deepMode ? 'hidden' : 'visible',
                margin: deepMode ? '0' : undefined,
              }}
            >
              <div className="md:hidden">
                <ExpandableSection
                  title="Media"
                  items={blogCards}
                  initialCount={2}
                />
              </div>
              <div className="hidden md:block">
                <div className="max-w-3xl mx-auto space-y-6">
                  {blogCards}
                </div>
              </div>
            </div>
          </section>

          {/* Blueprints Section — only visible in deep mode */}
          <section
            id="blueprints"
            className="md:mt-32"
            style={{
              height: deepMode ? 'auto' : '0',
              overflow: deepMode ? 'visible' : 'hidden',
              margin: deepMode ? undefined : '0',
            }}
          >
            <InProgressSection section="blueprints" title="Blueprints" visible={deepMode} />
          </section>
        </main>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <DeepModeProvider>
      <HomeContent />
    </DeepModeProvider>
  );
}
