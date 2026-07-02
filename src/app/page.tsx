"use client";
import React, { useRef, useState } from 'react';
import SidebarHome from './sidebar_content';
import About from './about/about_section';
import ExperienceCard from './work_experience/experience_card';
import ProjectCard from './projects/project_card';
import BlogCard from './blogs/blog_card';
import TheWebCard from './blogs/the_web_card';
import MouseGlow from '@/components/mouse_glow';
import HeaderMobile from '@/components/HeaderMobile';
import AboutSheet from '@/components/AboutSheet';
import { useDeepMode } from '@/components/DeepModeContext';
import DeepModeBorder from '@/components/DeepModeBorder';
import ExpandableSection from '@/components/ExpandableSection';
import InProgressSection from '@/components/InProgressSection';
import WebBanner from '@/components/WebBanner';
import { HarlequinPortalCards } from '@/components/dev/harlequin/HarlequinPortalCards';
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

  // #84 — accurate section jumps. <main> is the scroll container, so compute
  // the target against it (scrollIntoView's container alignment gives no
  // breathing room and can't recover from layout shift). After the smooth
  // scroll settles, correct once instantly if late-loading images or a
  // deep-mode toggle moved the target mid-flight.
  const scrollToSection = (id: string) => {
    const main = mainRef.current;
    const el = document.getElementById(id);
    if (!main || !el) return;
    const PAD = 24;
    const targetTop = () =>
      el.getBoundingClientRect().top - main.getBoundingClientRect().top + main.scrollTop - PAD;
    main.scrollTo({ top: targetTop(), behavior: 'smooth' });
    window.setTimeout(() => {
      const drift = el.getBoundingClientRect().top - main.getBoundingClientRect().top - PAD;
      if (Math.abs(drift) > 8) main.scrollTo({ top: targetTop(), behavior: 'auto' });
    }, 700);
  };

  const experienceCards = workExperiences.map((exp) => (
    <ExperienceCard key={exp.id} item={exp} />
  ));

  // Project cards, with THE HARLEQUIN portal card(s) injected between the
  // "euros-predictor" and "momentum" projects (their order in @/data/loaders).
  // HarlequinPortalCards renders all three shapes in Stage 1; flip to one random
  // in Stage 2 (seam documented inside that component).
  const projectCards: React.ReactNode[] = [];
  projects.forEach((proj) => {
    projectCards.push(<ProjectCard key={proj.id} project={proj} />);
    if (proj.id === 'proj_euros') {
      projectCards.push(<HarlequinPortalCards key="harlequin-portal" />);
    }
  });

  // Group blogs: The Web umbrella + its posts render as one composite card.
  // External blogs (e.g., Rice Discovery) render as standalone BlogCards.
  const webUmbrella = blogs.find((b) => b.link === '/the-web');
  const webPosts = blogs.filter((b) => b.link.startsWith('/the-web/'));
  const externalBlogs = blogs.filter((b) => !b.link.startsWith('/'));

  const mediaItems: React.ReactNode[] = [];
  if (webUmbrella) {
    mediaItems.push(
      <TheWebCard key="the-web" umbrella={webUmbrella} posts={webPosts} />
    );
  }
  externalBlogs.forEach((blog) => {
    mediaItems.push(<BlogCard key={blog.id} blog={blog} />);
  });

  return (
    // data-home-root: the HARLEQUIN exit transition waits for this to appear in
    // the DOM before disintegrating the board — proof the homepage has actually
    // painted underneath, so the dissolve reveals home (not a board reflash).
    <div data-home-root className="bg-gray-50 dark:bg-gray-900 min-h-screen">
      <MouseGlow />
      <DeepModeBorder />

      <HeaderMobile onOpenAbout={() => setAboutSheetOpen(true)} onToggleDeepMode={toggleDeepMode} />

      <AboutSheet
        open={aboutSheetOpen}
        onClose={() => setAboutSheetOpen(false)}
      />

      <div className="flex">
        <aside onWheel={handleSidebarWheel} className="hidden md:block fixed inset-y-0 left-0 w-1/3">
          <SidebarHome scrollToTop={scrollToTop} scrollToSection={scrollToSection} scrollRef={mainRef} />
        </aside>

        <main ref={mainRef} className="ml-0 md:ml-[33.3333%] w-full px-4 md:px-8 pt-1 md:pt-8 pb-20 overflow-y-auto md:h-screen space-y-6 md:space-y-32">
          {/* About Section */}
          <section id="about" className="hidden md:block md:mt-16">
            <About />
          </section>

          {/* The Web: new post banner */}
          <section className="!mt-4 md:!mt-8 !mb-0">
            <div className="max-w-[42rem] mx-auto">
              <WebBanner />
            </div>
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
                  items={mediaItems}
                  initialCount={2}
                />
              </div>
              <div className="hidden md:block">
                <div className="max-w-3xl mx-auto space-y-6">
                  {mediaItems}
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

          {/* THE HARLEQUIN portal now lives in the Projects list (above) as a
              project card. The bottom <PortalCircle /> was removed; ⌘⇧K remains
              the global fallback (wired in HarlequinPortalCard). */}
        </main>
      </div>

    </div>
  );
}

export default function Home() {
  return <HomeContent />;
}
