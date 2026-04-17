"use client";
import React, { useEffect, useState } from 'react';
import HomeContent from '../components/home_content';
import { FaLinkedin, FaGithub, FaEnvelope } from 'react-icons/fa';
import { SiCalendly } from 'react-icons/si';
import PlaygroundButton from '../components/PlaygroundButton';
import SpotifyBubble from '@/components/spotify/SpotifyBubble';

// Hook to detect the currently active section using Intersection Observer
const useActiveSection = (sectionIds: string[]): string => {
    const [activeSection, setActiveSection] = useState('');

    useEffect(() => {
        const observerOptions = {
            root: null,
            threshold: 0.6, // Section is considered active when 60% in view
        };

        const observerCallback: IntersectionObserverCallback = (entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    setActiveSection(entry.target.id);
                }
            });
        };

        const observer = new IntersectionObserver(observerCallback, observerOptions);
        sectionIds.forEach((id) => {
            const element = document.getElementById(id);
            if (element) {
                observer.observe(element);
            }
        });

        return () => observer.disconnect();
    }, [sectionIds]);

    return activeSection;
};

interface SidebarHomeProps {
    scrollToTop: () => void;
}

const SidebarHome: React.FC<SidebarHomeProps> = ({ scrollToTop }) => {
    const navItems = [
        { id: 'about', label: 'About' },
        { id: 'experience', label: 'Experience' },
        { id: 'projects', label: 'Projects' },
        { id: 'media', label: 'Media' },
    ];

    const activeSection = useActiveSection(navItems.map((item) => item.id));

    // Smooth scrolling handler
    const handleNavClick = (id: string) => (e: React.MouseEvent<HTMLAnchorElement>) => {
        e.preventDefault();
        if (id === 'about') {
            scrollToTop();
        } else {
            const element = document.getElementById(id);
            if (element) {
                element.scrollIntoView({ behavior: 'smooth' });
            }
        }
    };

    return (
        <div className="flex flex-col h-full p-8 text-center md:text-center">
            <div className="flex-shrink-0">
                {/* Profile container: fixed width and centered */}
                <div className="w-48 mx-auto">
                    <HomeContent
                        imageContainerSize="w-[13.5rem] h-[13.5rem]"
                        imageSize="w-[13rem] h-[13rem]"
                        headingSize="text-4xl"
                        containerClass="flex flex-col items-center justify-center py-8"
                        textWrapperClass="mt-4 text-center"
                    />
                </div>
                {/* Navigation links with sliding pill indicator */}
                <nav className="mt-8 w-48 mx-auto hidden md:block">
                    {(() => {
                        const ITEM_HEIGHT = 36;
                        const activeIndex = navItems.findIndex(item => item.id === activeSection);
                        return (
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
                                <ul>
                                    {navItems.map((item) => {
                                        const isActive = activeSection === item.id;
                                        return (
                                            <li key={item.id} style={{ height: ITEM_HEIGHT, display: 'flex', alignItems: 'center' }}>
                                                <a
                                                    href={`#${item.id}`}
                                                    onClick={handleNavClick(item.id)}
                                                    className={`
                                        text-xs uppercase tracking-wide font-medium w-full px-3
                                        transition-colors duration-200
                                        ${isActive
                                            ? 'text-blue-300 font-semibold'
                                            : 'text-gray-500 hover:text-gray-300'}
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
                        );
                    })()}
                </nav>
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
                        href="https://fantastical.app/mikeveson/mikeveson-meeting"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gray-700 dark:text-gray-200 dark:hover:text-blue-500 hover:text-[#ff7f32] transition-transform duration-300 transform hover:scale-110"
                    >
                        <SiCalendly size={24} />
                    </a>
                </div>
            </div>
        </div>
    );
};

export default SidebarHome;

