"use client";
import React from "react";
import Image from "next/image";
import { Blog } from "@/data/blogs";

interface BlogCardProps {
  blog: Blog;
}

export default function BlogCard({ blog }: BlogCardProps) {
  const openBlog = () => {
    window.open(blog.link, "_blank");
  };

  return (
    <div
      onClick={openBlog}
      role="link"
      tabIndex={0}
      className="max-w-[42rem] mx-auto w-full relative rounded-xl transition-all duration-300 ease-in-out md:hover:shadow-lg mb-6 cursor-pointer md:hover:bg-gradient-to-br md:hover:from-gray-100 md:hover:to-gray-200 md:hover:bg-opacity-80 dark:md:hover:from-gray-800 dark:md:hover:to-gray-700 dark:md:hover:bg-opacity-80"
    >
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex flex-col-reverse md:grid md:grid-cols-[minmax(0,280px),1fr] gap-x-4 items-start">
          {/* Left Column: Blog Image */}
          <div>
            <Image 
              src={blog.imageUrl}
              alt={blog.title}
              className="w-full h-auto object-cover rounded-md"
            />
          </div>
          {/* Right Column: Date and Title */}
          <div className="flex flex-col justify-center">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
              {blog.date}
            </p>
            <a
              href={blog.link}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-lg font-semibold text-gray-900 dark:text-gray-200 hover:underline"
            >
              {blog.title}
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
