'use client';

import React, { useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import Image from 'next/image';
import { preprocessDefinitions } from '../lib/preprocessDefinitions';
import BlogDefinitionCard from './BlogDefinitionCard';

interface MarkdownRendererProps {
  content: string;
  activeParagraphIndex?: number; // -1 or undefined = no highlighting
}

export default function MarkdownRenderer({ content, activeParagraphIndex = -1 }: MarkdownRendererProps) {
  const processedContent = preprocessDefinitions(content);

  // Track manual scrolling to pause auto-scroll
  const isUserScrollingRef = useRef(false);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Paragraph counter — reset on each render, incremented by the p renderer
  const paraCounterRef = useRef(0);
  paraCounterRef.current = 0;

  // Detect manual scroll → pause auto-scroll for 4 seconds
  useEffect(() => {
    const onScroll = () => {
      isUserScrollingRef.current = true;
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
      scrollTimeoutRef.current = setTimeout(() => {
        isUserScrollingRef.current = false;
      }, 4000);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    };
  }, []);

  // Auto-scroll to active paragraph when it changes
  useEffect(() => {
    if (activeParagraphIndex < 0 || isUserScrollingRef.current) return;
    const el = document.querySelector<HTMLElement>(`[data-para-idx="${activeParagraphIndex}"]`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [activeParagraphIndex]);

  return (
    <ReactMarkdown
      rehypePlugins={[rehypeRaw]}
      components={
        {
          h1: ({ children }: { children?: React.ReactNode }) => (
            <h1 className="text-2xl sm:text-3xl font-bold mt-10 mb-4 text-gray-100">
              {children}
            </h1>
          ),
          h2: ({ children }: { children?: React.ReactNode }) => (
            <h2 className="text-xl sm:text-2xl font-semibold mt-8 mb-3 text-gray-100">
              {children}
            </h2>
          ),
          h3: ({ children }: { children?: React.ReactNode }) => (
            <h3 className="text-lg sm:text-xl font-semibold mt-6 mb-2 text-gray-200">
              {children}
            </h3>
          ),
          p: ({ children }: { children?: React.ReactNode }) => {
            const idx = paraCounterRef.current++;
            const isActive = activeParagraphIndex === idx;
            const isPast = activeParagraphIndex > idx && activeParagraphIndex >= 0;
            return (
              <p
                data-para-idx={idx}
                className={[
                  'text-base leading-7 mb-4 transition-all duration-200',
                  isActive
                    ? 'text-gray-100 bg-teal-500/[0.08] border-l-2 border-teal-500 pl-3 -ml-[13px]'
                    : isPast
                    ? 'text-gray-300 opacity-50'
                    : 'text-gray-300',
                ].join(' ')}
              >
                {children}
              </p>
            );
          },
          a: ({ href, children }: { href?: string; children?: React.ReactNode }) => (
            <a
              href={href}
              className="text-teal-400 hover:text-teal-300 underline underline-offset-2"
              target="_blank"
              rel="noopener noreferrer"
            >
              {children}
            </a>
          ),
          blockquote: ({ children }: { children?: React.ReactNode }) => (
            <blockquote className="border-l-2 border-teal-500/50 pl-4 my-4 text-gray-400 italic">
              {children}
            </blockquote>
          ),
          code: ({ className, children }: { className?: string; children?: React.ReactNode }) => {
            const isBlock = className?.includes('language-');
            if (isBlock) {
              return (
                <code className="text-sm text-gray-300">{children}</code>
              );
            }
            return (
              <code className="bg-gray-800 px-1.5 py-0.5 rounded text-sm text-teal-300">
                {children}
              </code>
            );
          },
          pre: ({ children }: { children?: React.ReactNode }) => (
            <pre className="bg-gray-800 rounded-lg p-4 my-4 overflow-x-auto">
              {children}
            </pre>
          ),
          ul: ({ children }: { children?: React.ReactNode }) => (
            <ul className="list-disc list-outside pl-5 space-y-1 mb-4 text-gray-300">
              {children}
            </ul>
          ),
          ol: ({ children }: { children?: React.ReactNode }) => (
            <ol className="list-decimal list-outside pl-5 space-y-1 mb-4 text-gray-300">
              {children}
            </ol>
          ),
          li: ({ children }: { children?: React.ReactNode }) => (
            <li className="leading-7">{children}</li>
          ),
          hr: () => <hr className="border-gray-700 my-8" />,
          img: ({ src, alt }: { src?: string; alt?: string }) => (
            <span className="block my-6">
              <Image
                src={src || ''}
                alt={alt || ''}
                width={800}
                height={450}
                unoptimized
                className="w-full rounded"
              />
              {alt && (
                <span className="block text-center text-sm text-gray-500 mt-2">
                  {alt}
                </span>
              )}
            </span>
          ),
          hoverdef: ({
            children,
            term,
            definition,
            source,
            greek,
            link,
            kind,
            notitle,
          }: {
            children?: React.ReactNode;
            term?: string;
            definition?: string;
            source?: string;
            greek?: string;
            link?: string;
            kind?: string;
            notitle?: string;
          }) => (
            <BlogDefinitionCard
              term={term || ''}
              definition={definition || ''}
              source={source}
              greek={greek}
              link={link}
              kind={kind}
              notitle={notitle}
            >
              {children}
            </BlogDefinitionCard>
          ),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any
      }
    >
      {processedContent}
    </ReactMarkdown>
  );
}
