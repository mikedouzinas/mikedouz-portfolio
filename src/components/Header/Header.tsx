"use client";

import React from "react";
import { FaGithub, FaLinkedin, FaEnvelope } from "react-icons/fa";

export default function Header() {
  const scrollToSection = (sectionId: string) => {
    const section = document.getElementById(sectionId);
    if (section) {
      section.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <header className="fixed top-0 w-full bg-white dark:bg-gray-900 shadow-xl z-50">
      <div className="w-full pl-4 pr-4">
        <div className="flex justify-between items-center p-8">
          <nav className="flex space-x-8">
            <button
              onClick={() => scrollToSection("top")}
              className="text-gray-700 dark:text-gray-200 hover:text-blue-500 dark:hover:text-[#ff7f32] text-xl font-bold"
            >
              Home
            </button>
            <button
              onClick={() => scrollToSection("about")}
              className="text-gray-700 dark:text-gray-200 hover:text-blue-500 dark:hover:text-[#ff7f32] text-xl font-bold"
            >
              About
            </button>
            <button
              onClick={() => scrollToSection("experience")}
              className="text-gray-700 dark:text-gray-200 hover:text-blue-500 dark:hover:text-[#ff7f32] text-xl font-bold"
            >
              Experience
            </button>
            <button
              onClick={() => scrollToSection("projects")}
              className="text-gray-700 dark:text-gray-200 hover:text-blue-500 dark:hover:text-[#ff7f32] text-xl font-bold"
            >
              Projects
            </button>
          </nav>

          {/* Right side: Social icons */}
          <div className="flex space-x-4">
            <a
              href="https://github.com/mikedouzinas"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-700 dark:text-gray-200 hover:text-blue-500 dark:hover:text-[#ff7f32]"
            >
              <FaGithub size={30} />
            </a>
            <a
              href="https://www.linkedin.com/in/mikedouzinas"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-700 dark:text-gray-200 hover:text-blue-500 dark:hover:text-[#ff7f32]"
            >
              <FaLinkedin size={30} />
            </a>
            <a
              href="mailto:mike@douzinas.com"
              className="text-gray-700 dark:text-gray-200 hover:text-blue-500 dark:hover:text-[#ff7f32]"
            >
              <FaEnvelope size={30} />
            </a>
          </div>
        </div>
      </div>
    </header>
  );
}
