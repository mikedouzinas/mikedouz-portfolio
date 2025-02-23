"use client";
import React, { useEffect, useState } from 'react';
import HomeContent from '../components/home_content';
import { FaLinkedin, FaGithub, FaEnvelope } from 'react-icons/fa';

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
        <div className="flex flex-col h-full justify-between p-8 text-center md:text-left">
            <div>
                {/* Profile container: fixed width and centered */}
                <div className="w-48 mx-auto">
                    <HomeContent
                        imageContainerSize="w-[13.5rem] h-[13.5rem]"
                        imageSize="w-[13rem] h-[13rem]"
                        headingSize="text-4xl"
                        subTextSize="mt-2FaGithub text-lg"
                        containerClass="flex flex-col items-start justify-start py-8"
                        textWrapperClass="mt-4 text-left"
                    />
                </div>
                {/* Navigation links aligned with the profile container */}
                <nav className="mt-8 w-48 mx-auto hidden md:block">
                    <ul className="space-y-4 text-left">
                        {navItems.map((item) => {
                            const isActive = activeSection === item.id;
                            return (
                                <li key={item.id}>
                                    <a
                                        href={`#${item.id}`}
                                        onClick={handleNavClick(item.id)}
                                        className={`
              group flex items-center transition-all duration-300 ease-in-out 
              text-xs uppercase tracking-wide 
              ${isActive ? 'text-[#ff7f32] dark:text-blue-500' : 'text-gray-500 hover:text-[#ff7f32] dark:hover:text-blue-500'}`}>
                                        <div className={`transition-all duration-300 ease-in-out ${isActive
                                            ? 'bg-[#ff7f32] dark:bg-blue-500 w-4 mr-4'
                                            : 'bg-gray-900 dark:bg-white w-2 mr-2 group-hover:w-4 group-hover:mr-4'} h-4`}
                                        ></div>
                                        <span>{item.label}</span>
                                    </a>
                                </li>
                            );
                        })}
                    </ul>
                </nav>
            </div>
            {/* Social media icons aligned with the profile container */}
            <div className="w-48 mx-auto flex space-x-4">
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
            </div>
        </div>
    );
};

export default SidebarHome;

