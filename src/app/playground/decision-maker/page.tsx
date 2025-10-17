"use client";
import React, { useState } from 'react';
import Link from 'next/link';
import { FaArrowLeft } from 'react-icons/fa';

// TODO: Move this to a proper data source in future iteration
// Temporary inline project metadata for build compatibility
const project = {
  slug: 'decision-maker',
  name: 'Decision Maker',
  blurb: 'Can\'t decide? Let this tool help you make a choice with thoughtful reasoning.'
};

// Decision reasoning templates for fun explanations
const reasoningTemplates = [
  "This option caught my eye because it has that perfect blend of practical and ambitious.",
  "Sometimes the universe just points in a direction, and this feels like that direction.",
  "My gut says this one has the most potential for interesting outcomes.",
  "This choice feels like it would make the best story to tell later.",
  "There's something about this option that just makes sense right now.",
  "This one seems to have the right balance of challenge and achievability.",
  "My intuition is telling me this path has the most learning opportunities.",
  "This option feels like it would energize me the most to work on.",
  "Sometimes simple logic wins, and this is the most straightforward choice.",
  "This feels like the option that future-me would thank present-me for picking."
];

interface Decision {
  choice: string;
  reasoning: string;
  timestamp: Date;
}

export default function DecisionMakerPage() {
  const [options, setOptions] = useState('');
  const [criteria, setCriteria] = useState('');
  const [currentDecision, setCurrentDecision] = useState<Decision | null>(null);
  const [isDeciding, setIsDeciding] = useState(false);

  const handleDecide = () => {
    if (!options.trim()) return;
    
    setIsDeciding(true);
    
    // Simulate thinking time for better UX
    setTimeout(() => {
      const optionList = options.split('\n').filter(opt => opt.trim());
      if (optionList.length === 0) return;
      
      const randomChoice = optionList[Math.floor(Math.random() * optionList.length)].trim();
      const randomReasoning = reasoningTemplates[Math.floor(Math.random() * reasoningTemplates.length)];
      
      setCurrentDecision({
        choice: randomChoice,
        reasoning: randomReasoning,
        timestamp: new Date()
      });
      setIsDeciding(false);
    }, 1500);
  };

  const handleReset = () => {
    setCurrentDecision(null);
    setOptions('');
    setCriteria('');
  };

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

        {/* Main Interface */}
        {!currentDecision ? (
          <div className="space-y-6">
            {/* Options Input */}
            <div className="mv-card p-6">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">
                What are your options?
              </h3>
              <textarea
                value={options}
                onChange={(e) => setOptions(e.target.value)}
                placeholder="Enter each option on a new line:&#10;&#10;Go to the gym&#10;Work on side project&#10;Watch a movie&#10;Call a friend"
                rows={8}
                className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-lg border border-gray-300 dark:border-gray-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900 resize-none"
              />
            </div>

            {/* Optional Criteria */}
            <div className="mv-card p-6">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">
                Any specific criteria? (Optional)
              </h3>
              <textarea
                value={criteria}
                onChange={(e) => setCriteria(e.target.value)}
                placeholder="What factors should I consider?&#10;&#10;Examples:&#10;• Time available: 2 hours&#10;• Energy level: medium&#10;• Goals: health and productivity"
                rows={4}
                className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-lg border border-gray-300 dark:border-gray-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900 resize-none"
              />
            </div>

            {/* Decide Button */}
            <div className="text-center">
              <button
                onClick={handleDecide}
                disabled={!options.trim() || isDeciding}
                className="mv-btn-primary text-lg px-8 py-4 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isDeciding ? (
                  <div className="flex items-center space-x-2">
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                    <span>Deciding...</span>
                  </div>
                ) : (
                  'Make the Decision'
                )}
              </button>
            </div>
          </div>
        ) : (
          /* Decision Result */
          <div className="space-y-6">
            <div className="mv-card p-8 text-center mv-glow">
              <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-4">
                🎯 Decision Made
              </h2>
              <div className="bg-blue-600 text-white px-6 py-4 rounded-2xl text-xl font-semibold mb-6">
                {currentDecision.choice}
              </div>
              <div className="text-gray-600 dark:text-gray-400 text-lg leading-relaxed mb-4">
                <strong>Why this choice:</strong> {currentDecision.reasoning}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-500">
                Decision made at {currentDecision.timestamp.toLocaleTimeString()}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-center space-x-4">
              <button
                onClick={handleReset}
                className="mv-btn-neutral"
              >
                Make Another Decision
              </button>
              <button
                onClick={handleDecide}
                className="mv-btn-primary"
              >
                Decide Again
              </button>
            </div>

            {/* Context Display */}
            {(criteria.trim() || options.trim()) && (
              <div className="mv-card p-6">
                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">
                  Context
                </h3>
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-2">Options considered:</h4>
                    <ul className="text-gray-600 dark:text-gray-400 space-y-1">
                      {options.split('\n').filter(opt => opt.trim()).map((option, index) => (
                        <li key={index} className="flex items-center space-x-2">
                          <span className="w-2 h-2 bg-gray-400 rounded-full"></span>
                          <span>{option.trim()}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  {criteria.trim() && (
                    <div>
                      <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-2">Criteria:</h4>
                      <p className="text-gray-600 dark:text-gray-400 whitespace-pre-line">{criteria}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* How it Works */}
        <div className="mv-card p-6 mt-8">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">
            How it Works
          </h3>
          <div className="text-gray-600 dark:text-gray-400 space-y-2">
            <p>Sometimes we overthink decisions. This tool helps by:</p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Randomly selecting from your options (removing choice paralysis)</li>
              <li>Providing a thoughtful &ldquo;why&rdquo; to help you feel confident</li>
              <li>Giving you a moment to see if the choice feels right</li>
            </ul>
            <p className="mt-4 text-sm font-medium">
            Remember: If the result doesn&apos;t feel right, that&apos;s valuable information too! 
            Your gut reaction tells you what you actually want.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
