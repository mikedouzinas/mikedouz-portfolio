"use client";
import React, { useRef } from 'react';

export default function HomeSection() {
  const containerRef = useRef<HTMLDivElement>(null);
  const glareRef = useRef<HTMLDivElement>(null);
  // Flag to indicate if this is the first mouse move after entering
  const isFirstHover = useRef(true);
  
  const maxTilt = 6; // Maximum tilt angle (subtle)
  const scaleFactor = 1.03; // Forward pop effect

  const handleMouseEnter = () => {
    // On entering, use a 300ms transition for the "animate in" effect
    if (containerRef.current) {
      containerRef.current.style.transition = 'transform 300ms ease-out';
    }
    if (glareRef.current) {
      glareRef.current.style.transition = 'opacity 300ms ease-out';
    }
    isFirstHover.current = true;
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rotateY = ((x - centerX) / centerX) * maxTilt;
    const rotateX = -((y - centerY) / centerY) * maxTilt;
    
    // On the first movement, let the 300ms transition run.
    // For subsequent moves, switch to a 75ms transition for faster updates.
    if (!isFirstHover.current) {
      if (containerRef.current) {
        containerRef.current.style.transition = 'transform 75ms ease-out';
      }
      if (glareRef.current) {
        glareRef.current.style.transition = 'opacity 75ms ease-out';
      }
    } else {
      isFirstHover.current = false;
    }
    
    containerRef.current.style.transform = `perspective(1000px) scale(${scaleFactor}) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
    
    if (glareRef.current) {
      glareRef.current.style.background = `radial-gradient(circle at ${x}px ${y}px, rgba(255,255,255,0.2), transparent 60%)`;
      glareRef.current.style.opacity = "1";
    }
  };

  const handleMouseLeave = () => {
    if (containerRef.current) {
      // Smooth exit: animate back over 300ms
      containerRef.current.style.transition = 'transform 300ms ease-out';
      containerRef.current.style.transform = 'perspective(1000px) scale(1) rotateX(0deg) rotateY(0deg)';
    }
    if (glareRef.current) {
      glareRef.current.style.transition = 'opacity 300ms ease-out';
      glareRef.current.style.opacity = "0";
    }
    // Reset flag for next entry
    isFirstHover.current = true;
  };

  return (
    <section id="home" className="flex items-center justify-center py-20 bg-gray-50 dark:bg-gray-900">
      <div className="text-center">
        <span className="inline-block align-middle mx-3 relative">
          <div
            ref={containerRef}
            onMouseEnter={handleMouseEnter}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            className="w-[16.5rem] h-[16.5rem] rounded-full border-4 dark:border-orange-600 shadow-xl inline-flex items-center justify-center"
          >
            <img
              src="/profile.png"
              alt="Mike Veson"
              className="w-[16rem] h-[16rem] rounded-full"
            />
            {/* Glare overlay */}
            <div
              ref={glareRef}
              className="absolute inset-0 rounded-full pointer-events-none"
              style={{ opacity: 0 }}
            />
          </div>
        </span>
        <div className="py-8" />
        <h1 className="text-5xl md:text-8xl font-bold text-gray-800 dark:text-gray-200">
          Hi, I'm Mike Veson.
        </h1>
        <p className="mt-6 text-3xl text-gray-600 dark:text-gray-400">
          I'm a <strong>Computer Science Student</strong> at <strong>Rice University</strong>.
        </p>
        <div className="py-8" />
      </div>
    </section>
  );
}
