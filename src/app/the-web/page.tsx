"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import MouseGlow from "@/components/mouse_glow";
import { BlogPostPreview } from "@/lib/blog";
import PostCard from "./components/PostCard";
import TagFilter from "./components/TagFilter";
import SearchBar from "./components/SearchBar";
import WebPattern from "./components/WebPattern";

export default function BlogPage() {
  const [posts, setPosts] = useState<BlogPostPreview[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

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
      <MouseGlow />
      <WebPattern />

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
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight lowercase">
            the web
          </h1>
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
            <p className="text-gray-500 text-sm">loading...</p>
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
