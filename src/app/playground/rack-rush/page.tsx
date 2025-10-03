"use client";
import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { getProjectBySlug } from '@/data/playground';
import { FaArrowLeft } from 'react-icons/fa';

// Simple letter stream for the typing game
interface Letter {
  char: string;
  x: number;
  y: number;
  speed: number;
  id: number;
}

export default function RackRushPage() {
  const project = getProjectBySlug('rack-rush');
  const [isPlaying, setIsPlaying] = useState(false);
  const [score, setScore] = useState(0);
  const [wpm, setWpm] = useState(0);
  const [accuracy, setAccuracy] = useState(100);
  const [letters, setLetters] = useState<Letter[]>([]);
  const [currentInput, setCurrentInput] = useState('');
  const [totalTyped, setTotalTyped] = useState(0);
  const [correctTyped, setCorrectTyped] = useState(0);
  
  const gameAreaRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number | null>(null);
  const letterIdRef = useRef(0);
  const lastSpawnTime = useRef(0);
  const gameStartTime = useRef(0);

  const generateLetter = useCallback((): Letter => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    return {
      char: chars[Math.floor(Math.random() * chars.length)],
      x: Math.random() * 400, // Spawn across the width
      y: -20, // Start above visible area
      speed: 1 + Math.random() * 2, // Variable speed
      id: letterIdRef.current++
    };
  }, []);

  const gameLoop = useCallback((timestamp: number) => {
    if (!isPlaying) return;

    // Spawn new letters periodically
    if (timestamp - lastSpawnTime.current > 1000 + Math.random() * 1000) {
      setLetters(prev => [...prev, generateLetter()]);
      lastSpawnTime.current = timestamp;
    }

    // Update letter positions and remove off-screen letters
    setLetters(prev => 
      prev
        .map(letter => ({ ...letter, y: letter.y + letter.speed }))
        .filter(letter => letter.y < 400) // Remove letters that fall off screen
    );

    animationRef.current = requestAnimationFrame(gameLoop);
  }, [isPlaying, generateLetter]);

  useEffect(() => {
    if (isPlaying) {
      gameStartTime.current = Date.now();
      animationRef.current = requestAnimationFrame(gameLoop);
    } else {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying, gameLoop]);

  const handleStart = () => {
    setIsPlaying(true);
    setScore(0);
    setWpm(0);
    setAccuracy(100);
    setLetters([]);
    setCurrentInput('');
    setTotalTyped(0);
    setCorrectTyped(0);
    lastSpawnTime.current = 0;
  };

  const handlePause = () => {
    setIsPlaying(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value.toUpperCase();
    setCurrentInput(input);

    if (input.length > currentInput.length) {
      // User typed a character
      const typedChar = input[input.length - 1];
      setTotalTyped(prev => prev + 1);

      // Check if character matches any falling letter
      const matchingLetterIndex = letters.findIndex(letter => letter.char === typedChar);
      if (matchingLetterIndex !== -1) {
        setCorrectTyped(prev => prev + 1);
        setScore(prev => prev + 10);
        setLetters(prev => prev.filter((_, index) => index !== matchingLetterIndex));
        setCurrentInput(''); // Clear input after successful match
      }

      // Update stats
      if (totalTyped > 0) {
        const newAccuracy = Math.round((correctTyped / totalTyped) * 100);
        setAccuracy(newAccuracy);
        
        const timeElapsed = (Date.now() - gameStartTime.current) / 1000 / 60; // in minutes
        if (timeElapsed > 0) {
          const wordsTyped = correctTyped / 5; // Standard: 5 characters = 1 word
          setWpm(Math.round(wordsTyped / timeElapsed));
        }
      }
    }
  };

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

        {/* Game Controls */}
        <div className="mv-card p-6 mb-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex space-x-4">
              <button
                onClick={handleStart}
                className="mv-btn-primary"
                disabled={isPlaying}
              >
                Start
              </button>
              <button
                onClick={handlePause}
                className="mv-btn-neutral"
                disabled={!isPlaying}
              >
                Pause
              </button>
            </div>
            
            {/* Stats */}
            <div className="flex space-x-6 text-sm">
              <div className="text-center">
                <div className="text-gray-500 dark:text-gray-400">Score</div>
                <div className="font-semibold text-gray-800 dark:text-gray-200">{score}</div>
              </div>
              <div className="text-center">
                <div className="text-gray-500 dark:text-gray-400">WPM</div>
                <div className="font-semibold text-gray-800 dark:text-gray-200">{wpm}</div>
              </div>
              <div className="text-center">
                <div className="text-gray-500 dark:text-gray-400">Accuracy</div>
                <div className="font-semibold text-gray-800 dark:text-gray-200">{accuracy}%</div>
              </div>
            </div>
          </div>
        </div>

        {/* Game Area */}
        <div className="mv-card p-8">
          <div
            ref={gameAreaRef}
            className="relative bg-slate-800 rounded-2xl h-96 mb-6 overflow-hidden"
            style={{ background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)' }}
          >
            {/* Falling Letters */}
            {letters.map(letter => (
              <div
                key={letter.id}
                className="absolute text-2xl font-mono font-bold text-blue-400 pointer-events-none"
                style={{
                  left: `${letter.x}px`,
                  top: `${letter.y}px`,
                  textShadow: '0 0 10px rgba(59, 130, 246, 0.5)'
                }}
              >
                {letter.char}
              </div>
            ))}
            
            {/* Game Status Overlay */}
            {!isPlaying && letters.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center text-gray-400">
                  <div className="text-lg mb-2">Press Start to begin!</div>
                  <div className="text-sm">Type the falling letters as fast as you can</div>
                </div>
              </div>
            )}
          </div>

          {/* Input Area */}
          <div className="text-center">
            <input
              type="text"
              value={currentInput}
              onChange={handleInputChange}
              placeholder={isPlaying ? "Type the falling letters..." : "Game not started"}
              disabled={!isPlaying}
              className="w-full max-w-md px-4 py-2 bg-gray-700 text-gray-200 rounded-lg border border-gray-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900 disabled:opacity-50 disabled:cursor-not-allowed text-center text-lg font-mono"
              autoFocus
            />
            <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              Current input: <span className="font-mono">{currentInput || '(empty)'}</span>
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="mv-card p-6 mt-6">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3">
            How to Play
          </h3>
          <ul className="text-gray-600 dark:text-gray-400 space-y-2">
            <li>• Letters fall from the top of the screen</li>
            <li>• Type the letters as they appear to make them disappear</li>
            <li>• Each correct letter gives you 10 points</li>
            <li>• Try to maintain high accuracy and speed for the best WPM score</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
