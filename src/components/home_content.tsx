"use client";
import React, { useRef, useState, useCallback } from 'react';
import Image from "next/image";
import IrisButton from './IrisButton';
import { useDeepMode } from './DeepModeContext';

type HomeContentProps = {
  imageContainerSize: string;
  imageSize: string;
  headingSize: string;
  subTextSize: string;
  containerClass?: string;
  textWrapperClass?: string;
};

export default function HomeContent({
  imageContainerSize,
  imageSize,
  headingSize,
  containerClass = "flex flex-col items-center justify-start py-8 text-center",
  textWrapperClass = ""
}: Omit<HomeContentProps, 'subTextSize'>) {
  const [fadeOut] = useState(false);
  const [ringExiting, setRingExiting] = useState(false);
  const { deepMode, toggleDeepMode } = useDeepMode();
  const containerRef = useRef<HTMLDivElement>(null);
  const glareRef = useRef<HTMLDivElement>(null);
  const isFirstHover = useRef(true);
  const maxTilt = 10;
  const scaleFactor = 1.03;

  const handleProfileClick = useCallback(() => {
    if (deepMode) {
      // Exiting: play reverse animation before toggling off
      setRingExiting(true);
      // Toggle deep mode immediately so border bars start fading at the same time
      toggleDeepMode();
      setTimeout(() => {
        setRingExiting(false);
      }, 300);
    } else {
      toggleDeepMode();
    }
  }, [deepMode, toggleDeepMode]);

  const handleMouseEnter = () => {
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

    if (!isFirstHover.current) {
      containerRef.current.style.transition = 'transform 75ms ease-out';
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
      containerRef.current.style.transition = 'transform 300ms ease-out';
      containerRef.current.style.transform = 'perspective(1000px) scale(1) rotateX(0deg) rotateY(0deg)';
    }
    if (glareRef.current) {
      glareRef.current.style.transition = 'opacity 300ms ease-out';
      glareRef.current.style.opacity = "0";
    }
    isFirstHover.current = true;
  };

  return (
    <section
      id="home"
      className={`${containerClass} transition-opacity duration-300 ${fadeOut ? 'opacity-0' : 'opacity-100'} bg-gray-50 dark:bg-gray-900`}
    >
      {/* Profile photo - hidden on mobile (md:), visible on desktop */}
      <div className="hidden md:inline-block relative">
        <div
          ref={containerRef}
          onClick={handleProfileClick}
          onMouseEnter={handleMouseEnter}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          data-has-custom-glow="true"
          className={`rounded-full p-1 inline-flex items-center justify-center shadow-xl overflow-hidden cursor-pointer transition-all duration-500 ease-in-out ${
            ringExiting
              ? 'deep-ring-wrapper deep-ring-exiting'
              : deepMode
                ? 'deep-ring-wrapper'
                : 'bg-gradient-to-br from-orange-500 to-gray-100 dark:from-gray-800 dark:to-gray-700'
          }`}
        >
          <div className={`${imageContainerSize} rounded-full border-4 border-transparent relative inline-flex items-center justify-center overflow-hidden z-10`}>
            <Image
              src="/profile.png"
              alt="Mike Veson"
              width={150}
              height={150}
              className={`${imageSize} rounded-full`}
            />
            <div ref={glareRef} className="absolute inset-0 rounded-full pointer-events-none" style={{ opacity: 0 }} />
          </div>
        </div>
      </div>
      <div className="hidden md:block py-4" />
      <div className={textWrapperClass}>
        {/* Parent container with fixed width and centered alignment */}
        {/* Hidden on mobile since HeaderMobile now displays name and Iris button */}
        <div className="hidden md:flex w-48 flex-col items-center">
          <h1 className={`${headingSize} font-bold text-gray-800 dark:text-gray-200 w-full text-center`}>Mike Veson</h1>
          <div className="mt-4 w-full">
            <IrisButton />
          </div>
        </div>
      </div>
    </section>
  );
}
