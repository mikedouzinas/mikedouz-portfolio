"use client";
import React, { useEffect, useState } from 'react';
import HomeContent from '../components/home_content';
import { FaLinkedin, FaGithub, FaEnvelope } from 'react-icons/fa';
import { SiGooglemeet } from 'react-icons/si';
import PlaygroundButton from '../components/PlaygroundButton';
import SpotifyBubble from '@/components/spotify/SpotifyBubble';

const NAV_ITEMS = [
    { id: 'about', label: 'About' },
    { id: 'experience', label: 'Experience' },
    { id: 'projects', label: 'Projects' },
    { id: 'media', label: 'Media' },
];
const NAV_IDS = NAV_ITEMS.map((item) => item.id);

/**
 * Scroll-spy for the section nav (#84). The homepage scrolls inside <main>,
 * not the window, so the old viewport-rooted IntersectionObserver (with a 60%
 * threshold no tall section could ever reach) was unreliable. Instead, watch
 * the real scroll container: the active section is the last one whose top has
 * crossed a reading line 35% down the scrollport. A ResizeObserver re-computes
 * when deep-mode toggles or late-loading images shift the layout.
 */
const useActiveSection = (
    scrollRef: React.RefObject<HTMLElement | null>,
): string => {
    const [activeSection, setActiveSection] = useState(NAV_IDS[0]);

    useEffect(() => {
        const main = scrollRef.current;
        if (!main) return;

        let raf = 0;
        const compute = () => {
            raf = 0;
            const line = main.getBoundingClientRect().top + main.clientHeight * 0.35;
            let current = NAV_IDS[0];
            for (const id of NAV_IDS) {
                const el = document.getElementById(id);
                if (el && el.getBoundingClientRect().top <= line) current = id;
            }
            // Bottom clamp: a short final section may never cross the reading
            // line — when the container is scrolled out, it's still the one.
            if (main.scrollTop + main.clientHeight >= main.scrollHeight - 2) {
                current = NAV_IDS[NAV_IDS.length - 1];
            }
            setActiveSection(current);
        };
        const schedule = () => {
            if (!raf) raf = requestAnimationFrame(compute);
        };

        compute();
        main.addEventListener('scroll', schedule, { passive: true });
        window.addEventListener('resize', schedule);
        const ro = new ResizeObserver(schedule);
        ro.observe(main);
        for (const child of Array.from(main.children)) ro.observe(child);
        return () => {
            if (raf) cancelAnimationFrame(raf);
            main.removeEventListener('scroll', schedule);
            window.removeEventListener('resize', schedule);
            ro.disconnect();
        };
    }, [scrollRef]);

    return activeSection;
};

interface SidebarHomeProps {
    scrollToTop: () => void;
    scrollToSection: (id: string) => void;
    scrollRef: React.RefObject<HTMLElement | null>;
}

const SidebarHome: React.FC<SidebarHomeProps> = ({ scrollToTop, scrollToSection, scrollRef }) => {
    const navItems = NAV_ITEMS;
    const activeSection = useActiveSection(scrollRef);

    // Smooth scrolling handler
    const handleNavClick = (id: string) => (e: React.MouseEvent<HTMLAnchorElement>) => {
        e.preventDefault();
        if (id === 'about') {
            scrollToTop();
        } else {
            scrollToSection(id);
        }
    };

    // Must match the rendered height of each <li>
    const ITEM_HEIGHT = 36;
    const activeIndex = navItems.findIndex(item => item.id === activeSection);

    return (
        <div className="flex flex-col h-full p-8 text-center md:text-center">
            <div className="flex-shrink-0">
                {/* Shared container: profile + nav share same left edge */}
                <div className="w-fit mx-auto">
                    <div className="w-48">
                        <HomeContent
                            imageContainerSize="w-[13.5rem] h-[13.5rem]"
                            imageSize="w-[13rem] h-[13rem]"
                            headingSize="text-4xl"
                            containerClass="flex flex-col items-center justify-center py-8"
                            textWrapperClass="mt-4 text-center"
                        />
                    </div>
                {/* Navigation links with sliding pill indicator */}
                <nav className="mt-8 w-fit hidden md:block">
                    <div style={{ position: 'relative' }}>
                        <div style={{
                            position: 'absolute',
                            left: 0,
                            width: '100%',
                            height: ITEM_HEIGHT,
                            borderRadius: 7,
                            background: 'rgba(96, 165, 250, 0.13)',
                            border: '1px solid rgba(96, 165, 250, 0.25)',
                            top: activeIndex >= 0 ? activeIndex * ITEM_HEIGHT : 0,
                            opacity: activeIndex >= 0 ? 1 : 0,
                            transition: 'top 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s ease',
                            pointerEvents: 'none',
                        }} />
                        <ul className="text-left">
                            {navItems.map((item) => {
                                const isActive = activeSection === item.id;
                                return (
                                    <li key={item.id} style={{ height: ITEM_HEIGHT, display: 'flex', alignItems: 'center' }}>
                                        <a
                                            href={`#${item.id}`}
                                            onClick={handleNavClick(item.id)}
                                            aria-current={isActive ? 'location' : undefined}
                                            className={`
                                                block text-xs uppercase tracking-wide px-3
                                                transition-colors duration-200
                                                ${isActive
                                                    ? 'text-blue-300 font-semibold'
                                                    : 'text-gray-500 font-medium hover:text-gray-300'}
                                            `}
                                            style={{ position: 'relative', zIndex: 1 }}
                                        >
                                            {item.label}
                                        </a>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                </nav>
                </div>
            </div>
            {/* Spotify music timeline (deep mode only) */}
            <div className="flex-1 min-h-0 flex items-center py-6" id="spotify-sidebar-wrapper">
                <SpotifyBubble parentSelector="#spotify-sidebar-wrapper" />
            </div>
            {/* Social media icons aligned with the profile container */}
            <div className="flex-shrink-0 mt-auto w-48 mx-auto">
                <PlaygroundButton />
                <div className="flex space-x-4 justify-center md:justify-start">
                    <a
                        href="https://github.com/mikedouzinas"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gray-700 dark:text-gray-200 dark:hover:text-blue-500 hover:text-[#ff7f32] transition-transform duration-300 transform hover:scale-110"
                    >
                        <FaGithub size={24} />
                    </a>
                    <a
                        href="https://www.linkedin.com/in/mikedouzinas"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gray-700 dark:text-gray-200 dark:hover:text-blue-500 hover:text-[#ff7f32] transition-transform duration-300 transform hover:scale-110"
                    >
                        <FaLinkedin size={24} />
                    </a>
                    <a
                        href="mailto:mike@douzinas.com"
                        className="text-gray-700 dark:text-gray-200 dark:hover:text-blue-500 hover:text-[#ff7f32] transition-transform duration-300 transform hover:scale-110"
                    >
                        <FaEnvelope size={24} />
                    </a>
                    <a
                        href="https://calendar.app.google/2yzE7E52xmUSj3EP6"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gray-700 dark:text-gray-200 dark:hover:text-blue-500 hover:text-[#ff7f32] transition-transform duration-300 transform hover:scale-110"
                    >
                        <SiGooglemeet size={24} />
                    </a>
                </div>
            </div>
        </div>
    );
};

export default SidebarHome;

