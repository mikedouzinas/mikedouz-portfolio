"use client";
import React from "react";
import { blogs } from "@/data/loaders";
import BlogCard from "./blog_card";

export default function BlogsSection() {
  return (
    <section id="blogs" className="bg-gray-50 dark:bg-gray-900">
      <div className="max-w-3xl mx-auto space-y-6">
        {blogs.map((blog) => (
          <BlogCard key={blog.id} blog={blog} />
        ))}
      </div>
    </section>
  );
}
