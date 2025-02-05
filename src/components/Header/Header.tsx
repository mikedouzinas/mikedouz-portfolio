// src/components/Header/Header.tsx
import { FaGithub, FaLinkedin, FaEnvelope } from 'react-icons/fa';
import styles from './Header.module.css';

export default function Header() {
  return (
    <header className={styles.header}>
      <div className="w-full pl-4 pr-4">
        <div className={styles.headerInner}>
          {/* Left side: Navigation links */}
            <nav className={styles.nav}>
            <a href="#home" className={`${styles.link} font-bold`}>Home</a>
            <a href="#about" className={`${styles.link} font-bold`}>About</a>
            <a href="#experience" className={`${styles.link} font-bold`}>Experience</a>
            <a href="#projects" className={`${styles.link} font-bold`}>Projects</a>
            <a href="#blogs" className={`${styles.link} font-bold`}>Blogs</a>
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
            <a
              href="mailto:mike@douzinas.com"
              className={styles.link}
            >
              <FaEnvelope size={30} />
            </a>
          </div>
        </div>
      </div>
    </header>
  );
}
