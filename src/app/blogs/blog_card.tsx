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
      <div className="relative flex flex-col-reverse md:grid md:grid-cols-[minmax(0,280px),1fr] gap-x-4 items-start">
        {/* External link icon - top right of card */}
        {!blog.link.startsWith("/") && (
          <svg
            className="absolute top-0 right-0 w-4 h-4 text-gray-400 dark:text-gray-500 opacity-60"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
          </svg>
        )}
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
            target={blog.link.startsWith("/") ? undefined : "_blank"}
            rel={blog.link.startsWith("/") ? undefined : "noopener noreferrer"}
            onClick={(e) => e.stopPropagation()}
            className="text-lg font-semibold text-gray-900 dark:text-gray-200 group-hover:text-blue-800 dark:group-hover:text-blue-300 hover:underline block"
          >
            {blog.title}
          </a>
          {blog.description && (
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
              {blog.description}
            </p>
          )}
        </div>
      </div>
    </BaseCard>
  );
}
