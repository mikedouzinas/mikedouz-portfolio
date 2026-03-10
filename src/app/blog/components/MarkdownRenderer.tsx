'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import Image from 'next/image';

interface MarkdownRendererProps {
  content: string;
}

export default function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <ReactMarkdown
      components={{
        h1: ({ children }) => (
          <h1 className="text-2xl sm:text-3xl font-bold mt-10 mb-4 text-gray-100">
            {children}
          </h1>
        ),
        h2: ({ children }) => (
          <h2 className="text-xl sm:text-2xl font-semibold mt-8 mb-3 text-gray-100">
            {children}
          </h2>
        ),
        h3: ({ children }) => (
          <h3 className="text-lg sm:text-xl font-semibold mt-6 mb-2 text-gray-200">
            {children}
          </h3>
        ),
        p: ({ children }) => (
          <p className="text-base leading-7 text-gray-300 mb-4">{children}</p>
        ),
        a: ({ href, children }) => (
          <a
            href={href}
            className="text-purple-400 hover:text-purple-300 underline underline-offset-2"
            target="_blank"
            rel="noopener noreferrer"
          >
            {children}
          </a>
        ),
        blockquote: ({ children }) => (
          <blockquote className="border-l-2 border-purple-500/50 pl-4 my-4 text-gray-400 italic">
            {children}
          </blockquote>
        ),
        code: ({ className, children }) => {
          const isBlock = className?.includes('language-');
          if (isBlock) {
            return (
              <code className="text-sm text-gray-300">{children}</code>
            );
          }
          return (
            <code className="bg-gray-800 px-1.5 py-0.5 rounded text-sm text-purple-300">
              {children}
            </code>
          );
        },
        pre: ({ children }) => (
          <pre className="bg-gray-800 rounded-lg p-4 my-4 overflow-x-auto">
            {children}
          </pre>
        ),
        ul: ({ children }) => (
          <ul className="list-disc list-outside pl-5 space-y-1 mb-4 text-gray-300">
            {children}
          </ul>
        ),
        ol: ({ children }) => (
          <ol className="list-decimal list-outside pl-5 space-y-1 mb-4 text-gray-300">
            {children}
          </ol>
        ),
        li: ({ children }) => <li className="leading-7">{children}</li>,
        hr: () => <hr className="border-gray-700 my-8" />,
        img: ({ src, alt }) => (
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
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
