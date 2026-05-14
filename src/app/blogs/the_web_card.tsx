"use client";
import React, { useState } from "react";
import Image from "next/image";
import { ExternalLink, ChevronDown } from "lucide-react";
import BaseCard from "@/components/base_card";
import AskIrisButton from "@/components/AskIrisButton";
import { Blog } from "@/data/loaders";

interface TheWebCardProps {
  umbrella: Blog;
  posts: Blog[];
}

export default function TheWebCard({ umbrella, posts }: TheWebCardProps) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <BaseCard
      glowColor="45, 212, 191"
      glowIntensity={0.3}
      className="cursor-default"
    >
      <div className="relative flex flex-col-reverse md:grid md:grid-cols-[minmax(0,260px),1fr] gap-x-4 items-start">
        <div className="mt-4 md:mt-0 w-full">
          <Image
            src={umbrella.imageUrl}
            alt="the web"
            width={400}
            height={300}
            className="rounded-md object-cover w-[50%] md:w-full h-auto min-w-[150px]"
          />
        </div>
        <div className="flex flex-col w-full">
          <div className="flex items-start justify-between gap-2 mb-1">
            <a
              href="/the-web"
              onClick={(e) => e.stopPropagation()}
              className="text-xl font-semibold text-gray-900 dark:text-gray-200 hover:text-blue-800 dark:hover:text-blue-300 hover:underline"
            >
              {umbrella.title}
            </a>
            <a
              href="/the-web"
              aria-label="Visit the web"
              onClick={(e) => e.stopPropagation()}
              className="flex-shrink-0 inline-flex items-center justify-center hover:scale-110 transition-transform duration-200"
            >
              <ExternalLink className="w-5 h-5 text-blue-500 dark:text-blue-300 hover:text-blue-700 dark:hover:text-orange-500" />
            </a>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
            {umbrella.description}
          </p>

          <div className="mt-4 border-t border-gray-200 dark:border-gray-700/70">
            {posts.map((post) => {
              const isOpen = openId === post.id;
              const isExternal = !post.link.startsWith("/");
              return (
                <div
                  key={post.id}
                  className="border-b border-gray-100 dark:border-gray-800/70 last:border-b-0"
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenId(isOpen ? null : post.id);
                    }}
                    className="w-full flex items-center justify-between gap-3 py-2.5 text-left text-sm font-medium text-gray-800 dark:text-gray-200 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                    aria-expanded={isOpen}
                  >
                    <span className="min-w-0 truncate">{post.title}</span>
                    <ChevronDown
                      className={`w-4 h-4 flex-shrink-0 text-gray-500 dark:text-gray-400 transition-transform duration-200 ${
                        isOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <div className="pb-3 pr-1 text-sm text-gray-600 dark:text-gray-400">
                      {post.description && (
                        <p className="leading-relaxed mb-2">{post.description}</p>
                      )}
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <a
                          href={post.link}
                          target={isExternal ? "_blank" : undefined}
                          rel={isExternal ? "noopener noreferrer" : undefined}
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          Read full post
                          <ExternalLink className="w-3 h-3" />
                        </a>
                        <AskIrisButton
                          item={{ id: post.id, title: post.title }}
                          type="blog"
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-4 flex justify-end">
            <AskIrisButton
              item={{ id: umbrella.id, title: umbrella.title }}
              type="blog"
            />
          </div>
        </div>
      </div>
    </BaseCard>
  );
}
