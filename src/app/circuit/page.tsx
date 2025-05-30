"use client";
import React, { useState, useEffect, useRef } from 'react';
import { usePageTransition } from '@/components/PageTransition';
import PageTransition from '@/components/PageTransition';

export default function CircuitPage() {
  const { transitionTo } = usePageTransition();
  const [gameState, setGameState] = useState('intro'); // intro, playing, results
  const [phase, setPhase] = useState(1); // 1-3 phases
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(90);
  const [circuits, setCircuits] = useState<Circuit[]>([]);
  const [reactionTimes, setReactionTimes] = useState<number[]>([]);
  const [errors, setErrors] = useState({ false_positives: 0, missed: 0 });
  const [currentStimulus, setCurrentStimulus] = useState<Stimulus | null>(null);
  const [phaseData, setPhaseData] = useState<PhaseData>({ 1: [], 2: [], 3: [] });
  const stimulusTimeRef = useRef<NodeJS.Timeout | null>(null);
  const gameIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  interface Circuit {
    id: number;
    active: boolean;
    distractor: boolean;
    target: boolean;
    clicked: boolean;
  }

  interface Stimulus {
    time: number;
    targetIds: number[];
    requiredClicks?: number;
  }

  interface PhaseData {
    [key: number]: { rt: number; correct: boolean }[];
  }

  // Initialize circuit grid
  useEffect(() => {
    const grid: Circuit[] = [];
    for (let i = 0; i < 9; i++) {
      grid.push({
        id: i,
        active: false,
        distractor: false,
        target: false,
        clicked: false
      });
    }
    setCircuits(grid);
  }, []);

  // Game timer
  useEffect(() => {
    if (gameState === 'playing' && timeLeft > 0) {
      timerRef.current = setTimeout(() => {
        setTimeLeft(prev => prev - 1);
      }, 1000);
    } else if (timeLeft === 0 && gameState === 'playing') {
      endGame();
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [gameState, timeLeft]);

  // Phase transitions
  useEffect(() => {
    if (gameState === 'playing') {
      if (timeLeft === 60) setPhase(2);
      else if (timeLeft === 30) setPhase(3);
    }
  }, [timeLeft, gameState]);

  // Game loop for different phases
  useEffect(() => {
    if (gameState === 'playing') {
      runPhase();
    }
    return () => {
      if (gameIntervalRef.current) clearInterval(gameIntervalRef.current);
      if (stimulusTimeRef.current) clearTimeout(stimulusTimeRef.current);
    };
  }, [phase, gameState]);

  const runPhase = () => {
    if (gameIntervalRef.current) clearInterval(gameIntervalRef.current);
    
    const presentStimulus = () => {
      const newCircuits = circuits.map(c => ({ ...c, active: false, distractor: false, target: false, clicked: false }));
      
      if (phase === 1) {
        // Phase 1: Simple reaction time - one target
        const targetIdx = Math.floor(Math.random() * 9);
        newCircuits[targetIdx].target = true;
        newCircuits[targetIdx].active = true;
        setCurrentStimulus({ time: Date.now(), targetIds: [targetIdx] });
      } else if (phase === 2) {
        // Phase 2: Selective attention - target + distractors
        const targetIdx = Math.floor(Math.random() * 9);
        const distractorCount = Math.floor(Math.random() * 3) + 1;
        const distractorIndices: number[] = [];
        
        while (distractorIndices.length < distractorCount) {
          const idx = Math.floor(Math.random() * 9);
          if (idx !== targetIdx && !distractorIndices.includes(idx)) {
            distractorIndices.push(idx);
          }
        }
        
        newCircuits[targetIdx].target = true;
        newCircuits[targetIdx].active = true;
        distractorIndices.forEach(idx => {
          newCircuits[idx].distractor = true;
          newCircuits[idx].active = true;
        });
        setCurrentStimulus({ time: Date.now(), targetIds: [targetIdx] });
      } else if (phase === 3) {
        // Phase 3: Dual-task - multiple targets
        const targetCount = Math.floor(Math.random() * 2) + 2;
        const targetIndices: number[] = [];
        
        while (targetIndices.length < targetCount) {
          const idx = Math.floor(Math.random() * 9);
          if (!targetIndices.includes(idx)) {
            targetIndices.push(idx);
          }
        }
        
        targetIndices.forEach(idx => {
          newCircuits[idx].target = true;
          newCircuits[idx].active = true;
        });
        setCurrentStimulus({ time: Date.now(), targetIds: targetIndices, requiredClicks: targetCount });
      }
      
      setCircuits(newCircuits);
      
      // Auto-advance after time limit
      stimulusTimeRef.current = setTimeout(() => {
        handleTimeout();
      }, phase === 3 ? 3000 : 2000);
    };
    
    // Start presenting stimuli
    presentStimulus();
    gameIntervalRef.current = setInterval(presentStimulus, phase === 3 ? 4000 : 2500);
  };

  const handleTimeout = () => {
    if (currentStimulus) {
      const missedTargets = circuits.filter(c => c.target && !c.clicked).length;
      if (missedTargets > 0) {
        setErrors(prev => ({ ...prev, missed: prev.missed + missedTargets }));
      }
    }
  };

  const handleCircuitClick = (id: number) => {
    if (gameState !== 'playing' || !currentStimulus) return;
    
    const clickedCircuit = circuits[id];
    if (clickedCircuit.clicked) return;
    
    const newCircuits = [...circuits];
    newCircuits[id].clicked = true;
    setCircuits(newCircuits);
    
    if (clickedCircuit.target) {
      // Correct click
      const reactionTime = Date.now() - currentStimulus.time;
      setReactionTimes(prev => [...prev, reactionTime]);
      setScore(prev => prev + (phase * 10));
      
      // Record phase data
      setPhaseData(prev => ({
        ...prev,
        [phase]: [...prev[phase], { rt: reactionTime, correct: true }]
      }));
      
      // Check if all targets clicked in phase 3
      if (phase === 3 && currentStimulus.requiredClicks) {
        const clickedTargets = newCircuits.filter(c => c.target && c.clicked).length;
        if (clickedTargets === currentStimulus.requiredClicks) {
          if (stimulusTimeRef.current) clearTimeout(stimulusTimeRef.current);
          if (gameIntervalRef.current) clearInterval(gameIntervalRef.current);
          setTimeout(() => runPhase(), 500);
        }
      } else {
        // Single target phases - move to next stimulus
        if (stimulusTimeRef.current) clearTimeout(stimulusTimeRef.current);
        if (gameIntervalRef.current) clearInterval(gameIntervalRef.current);
        setTimeout(() => runPhase(), 500);
      }
    } else if (clickedCircuit.distractor || !clickedCircuit.active) {
      // False positive
      setErrors(prev => ({ ...prev, false_positives: prev.false_positives + 1 }));
      setPhaseData(prev => ({
        ...prev,
        [phase]: [...prev[phase], { rt: Date.now() - currentStimulus.time, correct: false }]
      }));
    }
  };

  const startGame = () => {
    setGameState('playing');
    setPhase(1);
    setScore(0);
    setTimeLeft(90);
    setReactionTimes([]);
    setErrors({ false_positives: 0, missed: 0 });
    setPhaseData({ 1: [], 2: [], 3: [] });
  };

  const endGame = () => {
    setGameState('results');
    if (gameIntervalRef.current) clearInterval(gameIntervalRef.current);
    if (stimulusTimeRef.current) clearTimeout(stimulusTimeRef.current);
    if (timerRef.current) clearTimeout(timerRef.current);
  };

  const calculateResults = () => {
    if (reactionTimes.length === 0) {
      return {
        avgRT: 0,
        consistency: 0,
        accuracy: 0,
        focusProfile: 'Incomplete Assessment'
      };
    }
    
    const avgRT = reactionTimes.reduce((a, b) => a + b, 0) / reactionTimes.length;
    const variance = reactionTimes.reduce((acc, rt) => acc + Math.pow(rt - avgRT, 2), 0) / reactionTimes.length;
    const stdDev = Math.sqrt(variance);
    const consistency = Math.max(0, 100 - (stdDev / avgRT * 100));
    
    const totalResponses = reactionTimes.length + errors.false_positives + errors.missed;
    const accuracy = totalResponses > 0 ? (reactionTimes.length / totalResponses * 100) : 0;
    
    // Determine focus profile based on performance patterns
    let focusProfile = '';
    if (avgRT < 400 && accuracy > 85 && consistency > 70) {
      focusProfile = 'Laser Focus';
    } else if (avgRT < 600 && accuracy > 70) {
      focusProfile = 'Sharp Attention';
    } else if (consistency > 75) {
      focusProfile = 'Steady Concentration';
    } else if (accuracy > 80) {
      focusProfile = 'Careful Processor';
    } else if (avgRT < 500) {
      focusProfile = 'Quick Responder';
    } else {
      focusProfile = 'Developing Focus';
    }
    
    return { avgRT: Math.round(avgRT), consistency: Math.round(consistency), accuracy: Math.round(accuracy), focusProfile };
  };

  const getPhaseInsights = () => {
    const insights: string[] = [];
    
    // Phase 1 analysis
    if (phaseData[1].length > 0) {
      const phase1RT = phaseData[1].filter(d => d.correct).map(d => d.rt);
      if (phase1RT.length > 0) {
        const avgPhase1 = phase1RT.reduce((a, b) => a + b, 0) / phase1RT.length;
        insights.push(`Baseline reaction time: ${Math.round(avgPhase1)}ms`);
      }
    }
    
    // Phase 2 analysis
    if (phaseData[2].length > 0) {
      const phase2Correct = phaseData[2].filter(d => d.correct).length;
      const phase2Total = phaseData[2].length;
      const distractorResistance = phase2Total > 0 ? (phase2Correct / phase2Total * 100) : 0;
      insights.push(`Distractor resistance: ${Math.round(distractorResistance)}%`);
    }
    
    // Phase 3 analysis
    if (phaseData[3].length > 0) {
      const phase3RT = phaseData[3].filter(d => d.correct).map(d => d.rt);
      if (phase3RT.length > 0) {
        const avgPhase3 = phase3RT.reduce((a, b) => a + b, 0) / phase3RT.length;
        insights.push(`Multi-tasking efficiency: ${avgPhase3 < 800 ? 'High' : avgPhase3 < 1200 ? 'Moderate' : 'Developing'}`);
      }
    }
    
    return insights;
  };

  const results = gameState === 'results' ? calculateResults() : null;
  const insights = gameState === 'results' ? getPhaseInsights() : [];

  const handleBack = () => {
    transitionTo('/');
  };

  return (
    <PageTransition>
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 relative p-4">
        <button
          onClick={handleBack}
          className="absolute top-6 left-6 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 border border-gray-400 dark:border-gray-600 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors duration-300"
        >
          Back
        </button>

        {gameState === 'intro' && (
          <div className="max-w-2xl mx-auto text-center space-y-6">
            <h1 className="text-5xl font-bold text-gray-800 dark:text-gray-200 mb-2">
              Neural Circuit
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-400 mb-6">
              Test your focus and attention in 90 seconds
            </p>
            
            <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-lg space-y-4">
              <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-200">How to Play</h2>
              <div className="text-left space-y-3 text-gray-600 dark:text-gray-400">
                <p><span className="font-semibold text-blue-600 dark:text-blue-400">Phase 1 (0-30s):</span> Click the blue glowing circuits as fast as you can</p>
                <p><span className="font-semibold text-yellow-600 dark:text-yellow-400">Phase 2 (30-60s):</span> Click only blue circuits, ignore red distractors</p>
                <p><span className="font-semibold text-purple-600 dark:text-purple-400">Phase 3 (60-90s):</span> Click all blue circuits before they disappear</p>
              </div>
              
              <button
                onClick={startGame}
                className="mt-6 px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-full transform hover:scale-105 transition-all duration-200 shadow-lg"
              >
                Start Assessment
              </button>
            </div>
          </div>
        )}

        {gameState === 'playing' && (
          <div className="w-full max-w-4xl mx-auto">
            <div className="mb-6 text-center">
              <div className="flex justify-between items-center mb-4">
                <div className="text-lg font-semibold text-gray-700 dark:text-gray-300">
                  Phase {phase}/3
                </div>
                <div className="text-2xl font-bold text-gray-800 dark:text-gray-200">
                  Score: {score}
                </div>
                <div className="text-lg font-semibold text-gray-700 dark:text-gray-300">
                  Time: {timeLeft}s
                </div>
              </div>
              
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                <div 
                  className="bg-gradient-to-r from-blue-500 to-purple-600 h-3 rounded-full transition-all duration-1000"
                  style={{ width: `${((90 - timeLeft) / 90) * 100}%` }}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 max-w-md mx-auto">
              {circuits.map((circuit) => (
                <button
                  key={circuit.id}
                  onClick={() => handleCircuitClick(circuit.id)}
                  className={`
                    w-24 h-24 rounded-2xl border-2 transition-all duration-300 transform
                    ${circuit.active && circuit.target ? 'bg-blue-500 border-blue-600 shadow-lg shadow-blue-500/50 scale-110 animate-pulse' : ''}
                    ${circuit.active && circuit.distractor ? 'bg-red-500 border-red-600 shadow-lg shadow-red-500/50 scale-105 animate-pulse' : ''}
                    ${!circuit.active ? 'bg-gray-200 dark:bg-gray-700 border-gray-300 dark:border-gray-600' : ''}
                    ${circuit.clicked && circuit.target ? 'bg-green-500 border-green-600' : ''}
                    ${circuit.clicked && !circuit.target ? 'bg-red-700 border-red-800' : ''}
                    hover:scale-105 active:scale-95
                  `}
                  disabled={circuit.clicked}
                >
                  <div className="w-full h-full flex items-center justify-center">
                    {circuit.active && (
                      <div className="w-3 h-3 bg-white rounded-full animate-ping" />
                    )}
                  </div>
                </button>
              ))}
            </div>

            <div className="mt-8 text-center text-gray-600 dark:text-gray-400">
              {phase === 1 && "Click the blue circuit!"}
              {phase === 2 && "Click blue circuits only - avoid red!"}
              {phase === 3 && "Click all blue circuits quickly!"}
            </div>
          </div>
        )}

        {gameState === 'results' && results && (
          <div className="max-w-2xl mx-auto text-center space-y-6">
            <h1 className="text-4xl font-bold text-gray-800 dark:text-gray-200 mb-4">
              Assessment Complete!
            </h1>
            
            <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-lg space-y-6">
              <div className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">
                {results.focusProfile}
              </div>
              
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-gray-800 dark:text-gray-200">{results.avgRT}ms</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Avg Reaction Time</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-800 dark:text-gray-200">{results.accuracy}%</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Accuracy</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-800 dark:text-gray-200">{results.consistency}%</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Consistency</div>
                </div>
              </div>
              
              {insights.length > 0 && (
                <div className="text-left space-y-2 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <h3 className="font-semibold text-gray-800 dark:text-gray-200">Performance Insights:</h3>
                  <ul className="space-y-1 text-gray-600 dark:text-gray-400">
                    {insights.map((insight, idx) => (
                      <li key={idx} className="flex items-start">
                        <span className="text-blue-500 mr-2">•</span>
                        {insight}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">Your Focus Tips:</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {results.focusProfile === 'Laser Focus' && "Your attention system is highly optimized. Consider practicing mindfulness to maintain this peak performance."}
                  {results.focusProfile === 'Sharp Attention' && "You demonstrate strong focus abilities. Try the Pomodoro Technique to maximize your natural attention spans."}
                  {results.focusProfile === 'Steady Concentration' && "Your consistent performance shows reliable focus. Practice brief meditation to enhance response speed."}
                  {results.focusProfile === 'Careful Processor' && "You prioritize accuracy over speed. Try timed exercises to build confidence in quick decisions."}
                  {results.focusProfile === 'Quick Responder' && "Your fast reactions are impressive. Focus on accuracy exercises to balance speed with precision."}
                  {results.focusProfile === 'Developing Focus' && "There's room to strengthen your attention. Start with 5-minute focus sessions and gradually increase duration."}
                </p>
              </div>
              
              <div className="flex gap-4 justify-center pt-4">
                <button
                  onClick={startGame}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-full transform hover:scale-105 transition-all duration-200"
                >
                  Try Again
                </button>
                <button
                  onClick={handleBack}
                  className="px-6 py-3 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-semibold rounded-full transform hover:scale-105 transition-all duration-200"
                >
                  Back to Portfolio
                </button>
              </div>
            </div>
            
            <div className="text-xs text-gray-500 dark:text-gray-500 mt-4">
              Score: {score} | Errors: {errors.false_positives + errors.missed}
            </div>
          </div>
        )}
      </div>
    </PageTransition>
  );
} 