"use client";
import React from "react";  
import Image from "next/image";
import { Blog } from "@/data/loaders";
import BaseCard from "@/components/base_card";
import AskIrisButton from "@/components/AskIrisButton";

interface BlogCardProps {
  blog: Blog;
}

export default function BlogCard({ blog }: BlogCardProps) {
  return (
    <BaseCard 
      href={blog.link}
      glowColor="251, 146, 60"  // Orange glow for blogs
      glowIntensity={0.3}
    >
      <div className="flex flex-col-reverse md:grid md:grid-cols-[minmax(0,280px),1fr] gap-x-4 items-start">
        <div>
          <Image
            src={blog.imageUrl}
            alt={blog.title}
            width={400}
            height={300}
            className="rounded-md object-cover"
          />
        </div>
        <div className="flex flex-col">
          <div className="flex flex-wrap justify-between items-center gap-y-2 gap-x-2 mb-1">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {blog.date}
            </p>
            {/* Action button: hidden on desktop idle, fade in on hover; always visible on mobile */}
            <div className="flex-shrink-0 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-[50ms]">
              <AskIrisButton item={blog} type="blog" />
            </div>
          </div>
          <a
            href={blog.link}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-lg font-semibold text-gray-900 dark:text-gray-200 group-hover:text-blue-800 dark:group-hover:text-blue-300 hover:underline block"
          >
            {blog.title}
          </a>
        </div>
      </div>
    </BaseCard>
  );
}
