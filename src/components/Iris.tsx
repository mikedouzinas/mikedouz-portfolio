"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command';
import { baseSuggestions, findAnswer } from '@/data/iris-kb';
import { Search, ArrowUpRight } from 'lucide-react';

export default function Iris() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [recentQuestions, setRecentQuestions] = useState<string[]>([]);
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile devices
  useEffect(() => {
    const checkMobile = () => {
      const userAgent = navigator.userAgent.toLowerCase();
      const mobileKeywords = ['mobile', 'iphone', 'ipad', 'android', 'blackberry', 'nokia', 'opera mini'];
      setIsMobile(mobileKeywords.some(keyword => userAgent.includes(keyword)));
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent opening on mobile
      if (isMobile) return;
      
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(prev => !prev);
      }
      
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isMobile]);

  // Listen for custom event from hero button
  useEffect(() => {
    const handleCustomOpen = () => {
      if (!isMobile) {
        setOpen(true);
      }
    };

    window.addEventListener('mv-open-cmdk', handleCustomOpen);
    return () => window.removeEventListener('mv-open-cmdk', handleCustomOpen);
  }, [isMobile]);

  // Reset state when closing
  useEffect(() => {
    if (!open) {
      setQuery('');
      setSelectedAnswer(null);
    }
  }, [open]);

  const handleSuggestionSelect = (suggestion: typeof baseSuggestions[0]) => {
    setQuery(suggestion.text);
    const answer = findAnswer(suggestion.text);
    setSelectedAnswer(answer);
    
    // Add to recent questions (max 3, avoid duplicates)
    setRecentQuestions(prev => {
      const updated = [suggestion.text, ...prev.filter(q => q !== suggestion.text)];
      return updated.slice(0, 3);
    });
  };

  const handleSearch = (searchQuery: string = query) => {
    if (!searchQuery.trim()) return;
    
    const answer = findAnswer(searchQuery);
    setSelectedAnswer(answer);
    
    // Add to recent questions
    setRecentQuestions(prev => {
      const updated = [searchQuery, ...prev.filter(q => q !== searchQuery)];
      return updated.slice(0, 3);
    });
  };

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSearch();
    }
  };

  const filteredSuggestions = useMemo(() => {
    if (!query.trim()) return baseSuggestions;
    
    const lowerQuery = query.toLowerCase();
    return baseSuggestions.filter(suggestion =>
      suggestion.text.toLowerCase().includes(lowerQuery)
    );
  }, [query]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent 
        className="max-w-2xl p-0 bg-slate-900/95 backdrop-blur border-white/10 shadow-2xl rounded-2xl"
        onPointerDownOutside={() => setOpen(false)}
      >
        <Command className="bg-transparent">
          <div className="relative">
            <CommandInput
              value={query}
              onValueChange={setQuery}
              onKeyDown={handleInputKeyDown}
              placeholder="Ask Iris anything…"
              className="border-0 bg-transparent text-white placeholder:text-gray-400 text-lg py-6 px-6 pr-12 focus:ring-0 focus:outline-none"
            />
            {/* Enter glyph */}
            <div className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-500">
              <ArrowUpRight className="w-5 h-5" />
            </div>
          </div>

          <CommandList className="max-h-96 overflow-y-auto px-2 pb-4">
            <CommandEmpty className="py-6 text-center text-gray-400">
              No suggestions found.
            </CommandEmpty>
            
            {/* Recent Questions */}
            {recentQuestions.length > 0 && !query.trim() && (
              <CommandGroup heading="Recent" className="text-gray-400 text-sm font-medium px-4 pb-2">
                {recentQuestions.map((question, index) => (
                  <CommandItem
                    key={`recent-${index}`}
                    onSelect={() => {
                      setQuery(question);
                      handleSearch(question);
                    }}
                    className="px-4 py-3 text-white hover:bg-slate-900/60 cursor-pointer rounded-lg mx-2 my-1 flex items-center gap-3"
                  >
                    <Search className="w-4 h-4 text-gray-400" />
                    <span>{question}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {/* Suggestions */}
            {filteredSuggestions.length > 0 && (
              <CommandGroup 
                heading={recentQuestions.length > 0 && !query.trim() ? "Suggestions" : ""} 
                className="text-gray-400 text-sm font-medium px-4 pb-2"
              >
                {filteredSuggestions.map((suggestion) => (
                  <CommandItem
                    key={suggestion.id}
                    onSelect={() => handleSuggestionSelect(suggestion)}
                    className="px-4 py-3 text-white hover:bg-slate-900/60 cursor-pointer rounded-lg mx-2 my-1 flex items-center gap-3"
                  >
                    <Search className="w-4 h-4 text-gray-400" />
                    <span>{suggestion.text}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>

          {/* Answer Panel */}
          {selectedAnswer && (
            <>
              <div className="border-t border-white/10 mx-4" />
              <div className="p-6 bg-slate-900/20 rounded-b-2xl">
                <div 
                  className="text-white text-sm leading-relaxed prose prose-invert max-w-none"
                  dangerouslySetInnerHTML={{
                    __html: selectedAnswer.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                  }}
                />
              </div>
            </>
          )}
        </Command>
      </DialogContent>
    </Dialog>
  );
}
