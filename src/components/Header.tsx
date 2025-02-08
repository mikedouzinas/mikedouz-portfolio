"use client";

import React, { useState } from "react";
import { FaGithub, FaLinkedin, FaEnvelope } from "react-icons/fa";
import { HiOutlineMenu, HiOutlineX } from "react-icons/hi";

export default function Header() {
  const [isOpen, setIsOpen] = useState(false);

  const scrollToSection = (sectionId: string) => {
    const section = document.getElementById(sectionId);
    if (section) {
      section.scrollIntoView({ behavior: "smooth" });
      setIsOpen(false); // Close the menu after navigation
    }
  };

  return (
    <header className="fixed top-0 w-full bg-gradient-to-br from-white to-gray-100 dark:from-gray-800 dark:to-gray-700 shadow-xl z-50">
      <div className="w-full px-4">
        {/* Top row */}
        <div className="flex justify-between items-center p-8">
          {/* Desktop Navigation */}
          <nav className="hidden md:flex space-x-8">
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

          {/* Desktop Social Icons */}
          <div className="hidden md:flex space-x-4">
            <a
              href="https://github.com/mikedouzinas"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-700 dark:text-gray-200 hover:text-blue-500 dark:hover:text-[#ff7f32] transition-transform duration-300 transform hover:scale-110"
            >
              <FaGithub size={30} />
            </a>
            <a
              href="https://www.linkedin.com/in/mikedouzinas"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-700 dark:text-gray-200 hover:text-blue-500 dark:hover:text-[#ff7f32] transition-transform duration-300 transform hover:scale-110"
            >
              <FaLinkedin size={30} />
            </a>
            <a
              href="mailto:mike@douzinas.com"
              className="text-gray-700 dark:text-gray-200 hover:text-blue-500 dark:hover:text-[#ff7f32] transition-transform duration-300 transform hover:scale-110"
            >
              <FaEnvelope size={30} />
            </a>
          </div>

          {/* Mobile View: Menu Button + "Mike Veson" */}
          <div className="md:hidden flex items-center space-x-4">
            <button onClick={() => setIsOpen(!isOpen)} aria-label="Toggle Menu">
              {isOpen ? <HiOutlineX size={30} /> : <HiOutlineMenu size={30} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation */}
      <div
        className={`
      md:hidden 
      absolute 
      left-0 
      w-full 
      bg-white dark:bg-gray-900 
      overflow-hidden 
      transition-all 
      duration-300 
      ease-in-out 
      z-40
      ${isOpen ? "max-h-72 opacity-100" : "max-h-0 opacity-0"} 
    `}
        style={{ top: "88px" }}
      >
        <div className="flex flex-col space-y-4 p-4">
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

          {/* Mobile Social Icons - Centered */}
          <div className="flex justify-center space-x-4 pt-2">
            <a
              href="https://github.com/mikedouzinas"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-700 dark:text-gray-200 hover:text-blue-500 dark:hover:text-[#ff7f32] transition-transform duration-300 transform hover:scale-110"
            >
              <FaGithub size={30} />
            </a>
            <a
              href="https://www.linkedin.com/in/mikedouzinas"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-700 dark:text-gray-200 hover:text-blue-500 dark:hover:text-[#ff7f32] transition-transform duration-300 transform hover:scale-110"
            >
              <FaLinkedin size={30} />
            </a>
            <a
              href="mailto:mike@douzinas.com"
              className="text-gray-700 dark:text-gray-200 hover:text-blue-500 dark:hover:text-[#ff7f32] transition-transform duration-300 transform hover:scale-110"
            >
              <FaEnvelope size={30} />
            </a>
          </div>
        </div>
      </div>
    </header>
  );
}
