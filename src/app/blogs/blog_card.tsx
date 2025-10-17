"use client";
import React from "react";  
import Image from "next/image";
import { Blog } from "@/data/loaders";
import BaseCard from "@/components/base_card";

interface BlogCardProps {
  blog: Blog;
}

export default function BlogCard({ blog }: BlogCardProps) {
  return (
    <BaseCard href={blog.link}>
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
        <div className="flex flex-col justify-center">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
            {blog.date}
          </p>
          <a
            href={blog.link}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-lg font-semibold text-gray-900 dark:text-gray-200 group-hover:text-blue-800 dark:group-hover:text-blue-300 hover:underline"
          >
            {blog.title}
          </a>
        </div>
      </div>
    </BaseCard>
  );
}
