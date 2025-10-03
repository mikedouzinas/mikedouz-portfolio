"use client";
import React from 'react';
import Link from 'next/link';
import { playgroundProjects } from '@/data/playground';
import { FaChevronRight } from 'react-icons/fa';

export default function PlaygroundPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-16 px-8">
      <div className="max-w-6xl mx-auto">
        {/* Header Section */}
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-gray-800 dark:text-gray-200 mb-4">
            Playground
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-400">
            Micro-projects, tools, and experiments I&apos;m playing with.
          </p>
        </div>

        {/* Project Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {playgroundProjects.map((project) => (
            <Link 
              key={project.slug} 
              href={`/playground/${project.slug}`}
              className="mv-card p-6 group hover:transform hover:-translate-y-1 block"
            >
              <article className="h-full flex flex-col justify-between">
                <div>
                  <h3 
                    className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-2"
                    aria-label={`${project.name} project`}
                  >
                    {project.name}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-4">
                    {project.blurb}
                  </p>
                </div>
                <div className="flex justify-end">
                  <FaChevronRight 
                    className="w-4 h-4 text-gray-500 dark:text-gray-400 group-hover:text-blue-500 transition-colors duration-300" 
                  />
                </div>
              </article>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
