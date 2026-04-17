'use client';

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
  const player = useAudioPlayer(slug, postTitle, coverImage);

  return (
    <>
      <ListenBar player={player} postTitle={postTitle} />
      <ListenCard player={player} readingTime={readingTime} />
      <PostBodyWithIris slug={slug} postTitle={postTitle}>
        <MarkdownRenderer content={postBody} activeParagraphIndex={player.activeParagraphIndex} />
      </PostBodyWithIris>
    </>
  );
}
