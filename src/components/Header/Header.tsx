// src/components/Header/Header.tsx
"use client";

import React from "react";
import { FaGithub, FaLinkedin, FaEnvelope } from "react-icons/fa";
import styles from "./Header.module.css";

export default function Header() {
  const scrollToSection = (sectionId: string) => {
    const section = document.getElementById(sectionId);
    if (section) {
      section.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <header className={styles.header}>
      <div className="w-full pl-4 pr-4">
        <div className={styles.headerInner}>
          <nav className={styles.nav}>
            <button
              onClick={() => scrollToSection("top")}
              className={`${styles.link} font-bold`}
            >
              Home
            </button>
            <button
              onClick={() => scrollToSection("about")}
              className={`${styles.link} font-bold`}
            >
              About
            </button>
            <button
              onClick={() => scrollToSection("experience")}
              className={`${styles.link} font-bold`}
            >
              Experience
            </button>
            <button
              onClick={() => scrollToSection("projects")}
              className={`${styles.link} font-bold`}
            >
              Projects
            </button>
          </nav>

          {/* Right side: Social icons */}
          <div className={styles.icons}>
            <a
              href="https://github.com/mikedouzinas"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.link}
            >
              <FaGithub size={30} />
            </a>
            <a
              href="https://www.linkedin.com/in/mikedouzinas"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.link}
            >
              <FaLinkedin size={30} />
            </a>
            <a href="mailto:mike@douzinas.com" className={styles.link}>
              <FaEnvelope size={30} />
            </a>
          </div>
        </div>
      </div>
    </header>
  );
}
