"use client";
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { getProjectBySlug } from '@/data/playground';
import { quotes } from '@/data/quotes';
import { FaArrowLeft } from 'react-icons/fa';

export default function QuotesPage() {
  const project = getProjectBySlug('quotes');
  const [currentQuoteIndex, setCurrentQuoteIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  // Auto-rotate quotes every 6 seconds
  useEffect(() => {
    if (isPaused) return;

    const interval = setInterval(() => {
      setIsTransitioning(true);
      
      setTimeout(() => {
        setCurrentQuoteIndex((prev) => (prev + 1) % quotes.length);
        setIsTransitioning(false);
      }, 300); // Fade duration
    }, 6000);

    return () => clearInterval(interval);
  }, [isPaused]);

  const handleNextQuote = () => {
    if (isTransitioning) return;
    
    setIsTransitioning(true);
    setTimeout(() => {
      setCurrentQuoteIndex((prev) => (prev + 1) % quotes.length);
      setIsTransitioning(false);
    }, 300);
  };

  const handlePrevQuote = () => {
    if (isTransitioning) return;
    
    setIsTransitioning(true);
    setTimeout(() => {
      setCurrentQuoteIndex((prev) => (prev - 1 + quotes.length) % quotes.length);
      setIsTransitioning(false);
    }, 300);
  };

  const currentQuote = quotes[currentQuoteIndex];

  if (!project) {
    return <div>Project not found</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-16 px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center mb-8">
          <Link 
            href="/playground" 
            className="mr-4 p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
          >
            <FaArrowLeft className="w-4 h-4 text-gray-600 dark:text-gray-400" />
          </Link>
          <div>
            <h1 className="text-4xl font-bold text-gray-800 dark:text-gray-200">
              {project.name}
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              {project.blurb}
            </p>
          </div>
        </div>

        {/* Main Quote Display */}
        <div className="mv-card p-8 mb-8 mv-glow">
          <div 
            className={`transition-opacity duration-300 ${isTransitioning ? 'opacity-0' : 'opacity-100'}`}
          >
            {/* Quote Text */}
            <blockquote className="text-2xl md:text-3xl font-medium text-gray-800 dark:text-gray-200 text-center mb-6 leading-relaxed">
              &ldquo;{currentQuote.text}&rdquo;
            </blockquote>
            
            {/* Author */}
            {currentQuote.author && (
              <div className="text-center mb-8">
                <cite className="text-lg text-gray-600 dark:text-gray-400 font-medium">
                  — {currentQuote.author}
                </cite>
              </div>
            )}

            {/* Why it matters */}
            <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700/50">
              <h3 className="text-lg font-semibold text-gray-200 mb-3 flex items-center">
                <span className="mr-2">💭</span>
                Why this resonates with me
              </h3>
              <p className="text-gray-300 leading-relaxed">
                {currentQuote.why}
              </p>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between mb-8">
          {/* Navigation */}
          <div className="flex items-center space-x-4">
            <button
              onClick={handlePrevQuote}
              disabled={isTransitioning}
              className="mv-btn-neutral disabled:opacity-50 disabled:cursor-not-allowed"
            >
              ← Previous
            </button>
            <button
              onClick={handleNextQuote}
              disabled={isTransitioning}
              className="mv-btn-neutral disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next →
            </button>
          </div>

          {/* Auto-rotation control */}
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setIsPaused(!isPaused)}
              className="mv-btn-neutral"
            >
              {isPaused ? '▶️ Resume' : '⏸️ Pause'}
            </button>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {currentQuoteIndex + 1} of {quotes.length}
            </div>
          </div>
        </div>

        {/* Progress Dots */}
        <div className="flex justify-center space-x-2 mb-8">
          {quotes.map((_, index) => (
            <button
              key={index}
              onClick={() => {
                if (isTransitioning) return;
                setIsTransitioning(true);
                setTimeout(() => {
                  setCurrentQuoteIndex(index);
                  setIsTransitioning(false);
                }, 300);
              }}
              className={`w-2 h-2 rounded-full transition-all duration-300 ${
                index === currentQuoteIndex
                  ? 'bg-blue-500 w-6'
                  : 'bg-gray-400 dark:bg-gray-600 hover:bg-blue-300'
              }`}
            />
          ))}
        </div>

        {/* All Quotes List */}
        <div className="mv-card p-6">
          <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-200 mb-6">
            All Quotes
          </h2>
          
          <div className="space-y-6">
            {quotes.map((quote, index) => (
              <div 
                key={index} 
                className={`p-4 rounded-lg border transition-all duration-300 cursor-pointer ${
                  index === currentQuoteIndex
                    ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700'
                    : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-750'
                }`}
                onClick={() => {
                  if (isTransitioning) return;
                  setIsTransitioning(true);
                  setTimeout(() => {
                    setCurrentQuoteIndex(index);
                    setIsTransitioning(false);
                  }, 300);
                }}
              >
                <div className="flex justify-between items-start mb-2">
                  <blockquote className="text-lg font-medium text-gray-800 dark:text-gray-200 flex-1 mr-4">
                    &ldquo;{quote.text}&rdquo;
                  </blockquote>
                  {index === currentQuoteIndex && (
                    <span className="mv-pill">Current</span>
                  )}
                </div>
                
                {quote.author && (
                  <cite className="text-sm text-gray-600 dark:text-gray-400 block mb-2">
                    — {quote.author}
                  </cite>
                )}
                
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {quote.why}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* About */}
        <div className="mv-card p-6 mt-8">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">
            About This Collection
          </h3>
          <div className="text-gray-600 dark:text-gray-400 space-y-2">
            <p>
              These are quotes that have stuck with me over the years. Each one captures something I believe 
              or aspire to live by.
            </p>
            <p>
              Rather than just collecting quotes, I&apos;ve included why each one resonates with me. Context matters—
              the same words can mean different things to different people based on their experiences.
            </p>
            <ul className="list-disc list-inside space-y-1 ml-4 mt-4">
              <li>Quotes auto-rotate every 6 seconds (you can pause this)</li>
              <li>Click on any quote in the list to jump to it</li>
              <li>Use the navigation buttons or progress dots to browse manually</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}