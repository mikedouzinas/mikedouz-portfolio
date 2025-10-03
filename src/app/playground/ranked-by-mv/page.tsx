"use client";
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { getProjectBySlug } from '@/data/playground';
import { FaArrowLeft } from 'react-icons/fa';

interface RatingCategory {
  id: string;
  name: string;
  score: number;
  note: string;
  weight: number;
}

interface SavedRating {
  id: string;
  title: string;
  categories: RatingCategory[];
  overallScore: number;
  timestamp: Date;
}

// Default categories for the rating system
const defaultCategories: Omit<RatingCategory, 'score' | 'note'>[] = [
  { id: 'quality', name: 'Quality/Craftsmanship', weight: 1 },
  { id: 'innovation', name: 'Innovation/Uniqueness', weight: 1 },
  { id: 'usefulness', name: 'Practical Value', weight: 1 },
  { id: 'design', name: 'Design/Aesthetics', weight: 1 },
  { id: 'personal', name: 'Personal Appeal', weight: 1 }
];

export default function RankedByMVPage() {
  const project = getProjectBySlug('ranked-by-mv');
  const [title, setTitle] = useState('');
  const [categories, setCategories] = useState<RatingCategory[]>(
    defaultCategories.map(cat => ({ ...cat, score: 5, note: '' }))
  );
  const [savedRatings, setSavedRatings] = useState<SavedRating[]>([]);

  // Load saved ratings from localStorage on component mount
  useEffect(() => {
    const saved = localStorage.getItem('mv_ranked_v1');
    if (saved) {
      try {
        const parsedRatings = JSON.parse(saved).map((rating: SavedRating & { timestamp: string }) => ({
          ...rating,
          timestamp: new Date(rating.timestamp)
        }));
        setSavedRatings(parsedRatings);
      } catch (error) {
        console.error('Error loading saved ratings:', error);
      }
    }
  }, []);

  // Calculate overall score (weighted average)
  const calculateOverallScore = (cats: RatingCategory[]): number => {
    const totalWeight = cats.reduce((sum, cat) => sum + cat.weight, 0);
    const weightedSum = cats.reduce((sum, cat) => sum + (cat.score * cat.weight), 0);
    return totalWeight > 0 ? Number((weightedSum / totalWeight).toFixed(1)) : 0;
  };

  const handleScoreChange = (categoryId: string, score: number) => {
    setCategories(prev => 
      prev.map(cat => 
        cat.id === categoryId ? { ...cat, score } : cat
      )
    );
  };

  const handleNoteChange = (categoryId: string, note: string) => {
    setCategories(prev => 
      prev.map(cat => 
        cat.id === categoryId ? { ...cat, note } : cat
      )
    );
  };

  const handleSave = () => {
    if (!title.trim()) return;
    
    const newRating: SavedRating = {
      id: Date.now().toString(),
      title: title.trim(),
      categories: [...categories],
      overallScore: calculateOverallScore(categories),
      timestamp: new Date()
    };

    const updatedRatings = [newRating, ...savedRatings];
    setSavedRatings(updatedRatings);
    localStorage.setItem('mv_ranked_v1', JSON.stringify(updatedRatings));
    
    // Reset form
    setTitle('');
    setCategories(defaultCategories.map(cat => ({ ...cat, score: 5, note: '' })));
  };

  const handleDelete = (ratingId: string) => {
    const updatedRatings = savedRatings.filter(rating => rating.id !== ratingId);
    setSavedRatings(updatedRatings);
    localStorage.setItem('mv_ranked_v1', JSON.stringify(updatedRatings));
  };

  const overallScore = calculateOverallScore(categories);
  
  // Get color for score display
  const getScoreColor = (score: number) => {
    if (score >= 8) return 'text-green-500';
    if (score >= 6) return 'text-yellow-500';
    if (score >= 4) return 'text-orange-500';
    return 'text-red-500';
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

        {/* Rating Form */}
        <div className="mv-card p-6 mb-8">
          <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-200 mb-6">
            Rate Something New
          </h2>
          
          {/* Title Input */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              What are you rating?
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., iPhone 15, The Bear (TV Show), Local Coffee Shop"
              className="w-full px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-lg border border-gray-300 dark:border-gray-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900"
            />
          </div>

          {/* Rating Categories */}
          <div className="space-y-6 mb-6">
            {categories.map((category) => (
              <div key={category.id} className="border-b border-gray-200 dark:border-gray-700 pb-6 last:border-b-0">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200">
                    {category.name}
                  </h3>
                  <div className={`text-2xl font-bold ${getScoreColor(category.score)}`}>
                    {category.score.toFixed(1)}/10
                  </div>
                </div>
                
                {/* Slider */}
                <div className="mb-3">
                  <input
                    type="range"
                    min="0"
                    max="10"
                    step="0.5"
                    value={category.score}
                    onChange={(e) => handleScoreChange(category.id, parseFloat(e.target.value))}
                    className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
                  />
                  <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                    <span>0</span>
                    <span>5</span>
                    <span>10</span>
                  </div>
                </div>

                {/* Note Input */}
                <input
                  type="text"
                  value={category.note}
                  onChange={(e) => handleNoteChange(category.id, e.target.value)}
                  placeholder="Optional note about this aspect..."
                  className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded border border-gray-200 dark:border-gray-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
            ))}
          </div>

          {/* Overall Score Display */}
          <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4 mb-6">
            <div className="text-center">
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Overall Score</div>
              <div className={`text-4xl font-bold ${getScoreColor(overallScore)}`}>
                {overallScore.toFixed(1)}/10
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="text-center">
            <button
              onClick={handleSave}
              disabled={!title.trim()}
              className="mv-btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Save Rating
            </button>
          </div>
        </div>

        {/* Saved Ratings */}
        {savedRatings.length > 0 && (
          <div className="mv-card p-6">
            <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-200 mb-6">
              My Ratings ({savedRatings.length})
            </h2>
            
            <div className="space-y-4">
              {savedRatings.map((rating) => (
                <div key={rating.id} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                      {rating.title}
                    </h3>
                    <div className="flex items-center space-x-3">
                      <div className={`text-xl font-bold ${getScoreColor(rating.overallScore)}`}>
                        {rating.overallScore}/10
                      </div>
                      <button
                        onClick={() => handleDelete(rating.id)}
                        className="text-red-500 hover:text-red-700 text-sm"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                    {rating.categories.map((cat) => (
                      <div key={cat.id} className="flex justify-between items-center">
                        <span className="text-gray-600 dark:text-gray-400">{cat.name}:</span>
                        <span className={`font-medium ${getScoreColor(cat.score)}`}>
                          {cat.score.toFixed(1)}
                        </span>
                      </div>
                    ))}
                  </div>
                  
                  <div className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                    Rated on {rating.timestamp.toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* How it Works */}
        <div className="mv-card p-6 mt-8">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">
            About the Rating System
          </h3>
          <div className="text-gray-600 dark:text-gray-400 space-y-2">
            <p>This is my personal take on rating things systematically, inspired by rating systems like Beli.</p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Each category is weighted equally (for now)</li>
              <li>Scores from 0-10 with 0.5 increments</li>
              <li>Overall score is the weighted average of all categories</li>
              <li>All ratings are saved locally in your browser</li>
            </ul>
            <div className="mt-4 space-y-1">
              <div className="font-medium">Score Interpretation:</div>
              <div className="text-sm ml-4">
                <div className="text-green-500">8-10: Excellent</div>
                <div className="text-yellow-500">6-7.9: Good</div>
                <div className="text-orange-500">4-5.9: Average</div>
                <div className="text-red-500">0-3.9: Poor</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
