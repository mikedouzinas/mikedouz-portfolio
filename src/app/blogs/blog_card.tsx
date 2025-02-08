"use client";
import React from "react";
import { Blog } from "@/data/blogs";

interface BlogCardProps {
  blog: Blog;
}

export default function BlogCard({ blog }: BlogCardProps) {
  return (
    <a
      href={blog.link}
      target="_blank"
      rel="noopener noreferrer"
      className="block"
    >
      <div
        className="max-w-[42rem] mx-auto w-full relative rounded-xl transition-all duration-300 ease-in-out 
          hover:shadow-lg hover:bg-gradient-to-br hover:from-gray-100 hover:to-gray-200 hover:bg-opacity-80 
          dark:hover:from-gray-800 dark:hover:to-gray-700 dark:hover:bg-opacity-80 mb-6"
      >
        {/* Inner container: limited width and padded to align with About/Experience */}
        <div className="max-w-2xl mx-auto px-4 py-6">
          <div className="grid grid-cols-[280px,1fr] gap-x-4 items-center">
            {/* Left Column: Blog Image */}
            <div>
              <img
                src={blog.imageUrl}
                alt={blog.title}
                className="w-[280px] h-[160px] object-cover rounded-md"
              />
            </div>
            {/* Right Column: Date (small grey text) and Title (larger, bold) vertically centered */}
            <div className="flex flex-col justify-center">
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                {blog.date}
              </p>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-200">
                {blog.title}
              </h3>
            </div>
          </div>
        </div>
      </div>
    </a>
  );
}
