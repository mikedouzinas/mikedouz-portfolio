"use client";
import React, { useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { ExternalLink, ChevronRight } from "lucide-react";
import ContainedWebPattern from "@/components/ContainedWebPattern";
import ContainedMouseGlow from "@/components/ContainedMouseGlow";
import AskIrisButton from "@/components/AskIrisButton";
import { Blog } from "@/data/loaders";

interface TheWebCardProps {
  umbrella: Blog;
  posts: Blog[];
  /** How many posts to surface on the card. The rest live behind "more posts →". */
  visibleCount?: number;
}

/**
 * The Web is rendered as a single composite card. Posts list as plaintext,
 * the contained spider-web pattern reveals beneath the cursor on hover (same
 * mechanic as the /the-web page background), and the top-right action group
 * holds the navigate-arrow (always visible) plus an Ask Iris button that
 * fades in on hover.
 */
export default function TheWebCard({ umbrella, posts, visibleCount = 3 }: TheWebCardProps) {
  const sorted = useMemo(
    () =>
      [...posts].sort(
        (a, b) =>
          new Date(b.publishedDate).getTime() - new Date(a.publishedDate).getTime()
      ),
    [posts]
  );

  const visible = sorted.slice(0, visibleCount);
  const hasMore = sorted.length > visibleCount;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3 }}
      data-has-contained-glow="true"
      role="link"
      tabIndex={0}
      onClick={() => {
        window.location.href = "/the-web";
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          window.location.href = "/the-web";
        }
      }}
      className="max-w-[42rem] mx-auto w-full relative rounded-xl overflow-hidden group cursor-pointer md:hover:shadow-lg transition-shadow duration-300 md:hover:bg-gradient-to-br md:hover:from-gray-100 md:hover:to-gray-200 md:hover:bg-opacity-80 dark:md:hover:from-gray-800 dark:md:hover:to-gray-700 dark:md:hover:bg-opacity-80"
    >
      {/* Teal light glow underneath, with the spider web revealed on top of it.
          Both fade in on hover and follow the cursor inside the card. */}
      <ContainedMouseGlow color="45, 212, 191" intensity={0.22} size={180} />
      <ContainedWebPattern color="#2dd4bf" revealRadius={170} />

      <div className="max-w-2xl mx-auto px-4 py-6 relative z-10">
        <div className="flex flex-col-reverse md:grid md:grid-cols-[minmax(0,220px),1fr] gap-x-4 items-start">
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
            {/* Header row: title + top-right action stack (Ask Iris on hover, arrow always) */}
            <div className="flex items-start justify-between gap-2 mb-1">
              <Link
                href="/the-web"
                onClick={(e) => e.stopPropagation()}
                className="text-xl font-semibold text-gray-900 dark:text-gray-200 hover:text-teal-600 dark:hover:text-teal-300 transition-colors"
              >
                {umbrella.title}
              </Link>

              <div className="flex items-center gap-2 flex-shrink-0">
                <div className="opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-150">
                  <AskIrisButton
                    item={{ id: umbrella.id, title: umbrella.title }}
                    type="blog"
                  />
                </div>
                <Link
                  href="/the-web"
                  aria-label="Visit the web"
                  onClick={(e) => e.stopPropagation()}
                  className="inline-block hover:scale-110 transition-transform duration-200 ease-out"
                >
                  <ExternalLink className="w-5 h-5 text-blue-500 dark:text-blue-300 hover:text-blue-700 dark:hover:text-orange-500" />
                </Link>
              </div>
            </div>

            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
              {umbrella.description}
            </p>

            {/* Thin section divider, then the plaintext post list. */}
            <div className="mt-4 mb-3 h-px w-full bg-gray-200/80 dark:bg-gray-700/60" />

            <div className="flex flex-col">
              {hasMore && (
                <Link
                  href="/the-web"
                  onClick={(e) => e.stopPropagation()}
                  className="self-start mb-1.5 text-[10px] uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400 hover:text-teal-600 dark:hover:text-teal-300 transition-colors"
                >
                  more posts &rarr;
                </Link>
              )}

              <ul className="flex flex-col">
                {visible.map((post) => {
                  const isExternal = !post.link.startsWith("/");
                  return (
                    <li key={post.id}>
                      <a
                        href={post.link}
                        target={isExternal ? "_blank" : undefined}
                        rel={isExternal ? "noopener noreferrer" : undefined}
                        onClick={(e) => e.stopPropagation()}
                        className="group/post inline-flex items-center gap-1 py-0.5 text-xs text-gray-700 dark:text-gray-300 hover:text-teal-600 dark:hover:text-teal-300 transition-colors"
                      >
                        <span>{post.title}</span>
                        <ChevronRight
                          className="w-3 h-3 -translate-x-1 opacity-0 group-hover/post:translate-x-0 group-hover/post:opacity-100 transition-all duration-200"
                        />
                      </a>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
