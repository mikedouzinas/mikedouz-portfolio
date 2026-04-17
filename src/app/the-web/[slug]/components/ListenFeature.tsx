'use client';

import { useRef } from 'react';
import { useAudioPlayer } from '@/hooks/useAudioPlayer';
import ListenCard from './ListenCard';
import ListenBar from './ListenBar';
import PostBodyWithIris from '../../components/PostBodyWithIris';
import MarkdownRenderer from '../../components/MarkdownRenderer';

interface ListenFeatureProps {
  slug: string;
  postTitle: string;
  postBody: string;
  readingTime: number;
  coverImage: string | null;
}

export default function ListenFeature({
  slug,
  postTitle,
  postBody,
  readingTime,
  coverImage,
}: ListenFeatureProps) {
  // Ref attached to the rendered post body. useAudioPlayer reads [data-para-idx]
  // elements from this container to build the paragraph list for TTS generation.
  // This ensures timestamps align exactly with what the renderer counts.
  const contentRef = useRef<HTMLDivElement>(null);
  const player = useAudioPlayer(slug, postTitle, coverImage, contentRef);

  return (
    <>
      <ListenBar player={player} postTitle={postTitle} />
      <ListenCard player={player} readingTime={readingTime} />
      <PostBodyWithIris slug={slug} postTitle={postTitle}>
        <div ref={contentRef}>
          <MarkdownRenderer content={postBody} activeParagraphIndex={player.activeParagraphIndex} />
        </div>
      </PostBodyWithIris>
    </>
  );
}
