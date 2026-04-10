"use client";

import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import ContainedMouseGlow from "@/components/ContainedMouseGlow";
import { BlogPostPreview } from "@/lib/blog";

interface PostCardProps {
  post: BlogPostPreview;
  index: number;
}

export default function PostCard({ post, index }: PostCardProps) {
  const glowColor = post.theme?.accent_color || "45, 212, 191";

  const formattedDate = new Date(post.published_at).toLocaleDateString(
    "en-US",
    { month: "long", day: "numeric", year: "numeric" }
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.05 }}
    >
      <Link href={`/the-web/${post.slug}`}>
        <div
          data-has-contained-glow="true"
          className="relative overflow-hidden rounded-xl cursor-pointer group hover:shadow-lg transition-shadow duration-300 hover:bg-gradient-to-br hover:from-gray-800 hover:to-gray-700 p-5"
        >
          <ContainedMouseGlow color={glowColor} />

          <div className="flex items-center gap-3 text-xs text-gray-500 mb-2">
            <span>{formattedDate}</span>
            <span>&middot;</span>
            <span>{post.reading_time} min read</span>
            {post.comment_count > 0 && (
              <>
                <span>&middot;</span>
                <span>{post.comment_count} comment{post.comment_count !== 1 ? 's' : ''}</span>
              </>
            )}
          </div>

          <h2 className="text-lg font-semibold text-gray-100 group-hover:text-white transition-colors mb-1">
            {post.title}
          </h2>

          {post.subtitle && (
            <p className="text-sm text-gray-400 mb-2">{post.subtitle}</p>
          )}

          <p className="text-sm text-gray-500 leading-relaxed mb-3">
            {post.preview}
          </p>

          {post.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {post.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-0.5 text-xs rounded-full bg-teal-500/10 text-teal-400 border border-teal-500/20"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </Link>
    </motion.div>
  );
}
