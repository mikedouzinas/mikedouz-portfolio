"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { BlogPostPreview } from "@/lib/blog";
import PostCard from "./components/PostCard";
import TagFilter from "./components/TagFilter";
import SearchBar from "./components/SearchBar";
import WebLoader from "./components/WebLoader";
import SubscribeWidget from "./components/SubscribeWidget";

export default function BlogPage() {
  const [posts, setPosts] = useState<BlogPostPreview[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);

  // Handle subscribe confirmation/unsubscribe toasts from URL params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const subscribeStatus = params.get('subscribe');
    if (subscribeStatus === 'confirmed') {
      setToast({ message: "you're in. you'll hear from me when i publish.", type: 'success' });
    } else if (subscribeStatus === 'removed') {
      setToast({ message: "unsubscribed. no hard feelings.", type: 'info' });
    } else if (subscribeStatus === 'invalid' || subscribeStatus === 'error') {
      setToast({ message: "that link didn't work. try subscribing again.", type: 'error' });
    }
    if (subscribeStatus) {
      window.history.replaceState({}, '', '/the-web');
      const timer = setTimeout(() => setToast(null), 5000);
      return () => clearTimeout(timer);
    }
  }, []);

  // Fetch tags once on mount
  useEffect(() => {
    fetch("/api/the-web?tags_only=true")
      .then((res) => res.json())
      .then((data) => setTags(data.tags || []))
      .catch(console.error);
  }, []);

  // Fetch posts when filters change
  const fetchPosts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (activeTag) params.set("tag", activeTag);
      if (searchQuery) params.set("search", searchQuery);

      const res = await fetch(`/api/the-web?${params.toString()}`);
      const data = await res.json();
      setPosts(data.posts || []);
    } catch (err) {
      console.error("Failed to fetch posts:", err);
    } finally {
      setLoading(false);
    }
  }, [activeTag, searchQuery]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  const handleTagClick = useCallback((tag: string | null) => {
    setActiveTag(tag);
  }, []);

  return (
    <div className="relative min-h-screen bg-gray-900 text-gray-100">
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg text-sm ${
              toast.type === 'success' ? 'bg-green-900/80 text-green-300 border border-green-700/50' :
              toast.type === 'error' ? 'bg-red-900/80 text-red-300 border border-red-700/50' :
              'bg-gray-800/80 text-gray-300 border border-gray-700/50'
            } backdrop-blur-sm`}
          >
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative max-w-2xl mx-auto px-4 sm:px-6 py-12 sm:py-20">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Link
            href="/"
            className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
          >
            &larr; mikeveson.com
          </Link>
        </motion.div>

        <div className="mt-8 mb-8">
          <div className="flex items-baseline justify-between gap-4 flex-wrap">
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight lowercase">
              the web
            </h1>
            <SubscribeWidget />
          </div>
          <p className="mt-2 text-gray-400 text-sm sm:text-base">
            research, reactions, and thinking. all connected.
          </p>
        </div>

        <div className="space-y-4 mb-8">
          <SearchBar onSearch={handleSearch} />
          <TagFilter
            tags={tags}
            activeTag={activeTag}
            onTagClick={handleTagClick}
          />
        </div>

        <div className="space-y-4">
          {loading ? (
            <WebLoader />
          ) : posts.length === 0 ? (
            activeTag || searchQuery ? (
              <p className="text-gray-500 text-sm">no posts match that filter.</p>
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="py-12 text-center space-y-4"
              >
                <p className="text-gray-400 text-base leading-relaxed max-w-md mx-auto">
                  this is where my research, philosophical analysis, and reactions live.
                  everything connected, nothing polished for the sake of it.
                </p>
                <p className="text-gray-500 text-sm">
                  posts are coming. check back soon.
                </p>
              </motion.div>
            )
          ) : (
            posts.map((post, index) => (
              <PostCard key={post.id} post={post} index={index} />
            ))
          )}
        </div>

      </div>
    </div>
  );
}
