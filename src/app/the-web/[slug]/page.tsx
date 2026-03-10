import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getPostBySlug, getAdjacentPosts } from '@/lib/blog';
import MarkdownRenderer from '../components/MarkdownRenderer';
import ShareButton from '../components/ShareButton';

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) return { title: 'Not Found | Mike Veson' };
  return {
    title: `${post.title} | The Web`,
    description: post.subtitle || post.body.slice(0, 160),
    openGraph: {
      title: post.title,
      description: post.subtitle || post.body.slice(0, 160),
      url: `https://mikeveson.com/the-web/${slug}`,
      type: 'article',
      publishedTime: post.published_at,
      ...(post.cover_image ? { images: [post.cover_image] } : {}),
    },
  };
}

export default async function BlogPostPage({ params }: PageProps) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);

  if (!post) notFound();

  const { prev, next } = await getAdjacentPosts(post.published_at);

  const formattedDate = new Date(post.published_at).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100">
      <article className="max-w-2xl mx-auto px-4 sm:px-6 py-12 sm:py-20">
        {/* Back link */}
        <Link
          href="/the-web"
          className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
        >
          &larr; the web
        </Link>

        {/* Header */}
        <header className="mb-10 mt-8">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight leading-tight">
            {post.title}
          </h1>

          {post.subtitle && (
            <p className="mt-2 text-lg text-gray-400">{post.subtitle}</p>
          )}

          <div className="mt-4 flex items-center gap-2 text-sm text-gray-500">
            <time dateTime={post.published_at}>{formattedDate}</time>
            <span>&middot;</span>
            <span>{post.reading_time} min read</span>
            <span>&middot;</span>
            <ShareButton />
          </div>

          {post.tags.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {post.tags.map((tag) => (
                <Link
                  key={tag}
                  href={`/the-web?tag=${encodeURIComponent(tag)}`}
                  className="px-2.5 py-0.5 text-xs rounded-full bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 transition-colors"
                >
                  {tag}
                </Link>
              ))}
            </div>
          )}
        </header>

        {/* Body */}
        <MarkdownRenderer content={post.body} />

        {/* Prev / Next navigation */}
        {(prev || next) && (
          <nav className="mt-16 pt-8 border-t border-gray-800 flex justify-between">
            {prev ? (
              <Link
                href={`/the-web/${prev.slug}`}
                className="text-sm text-gray-400 hover:text-purple-300 transition-colors"
              >
                &larr; {prev.title}
              </Link>
            ) : (
              <span />
            )}
            {next ? (
              <Link
                href={`/the-web/${next.slug}`}
                className="text-sm text-gray-400 hover:text-purple-300 transition-colors text-right"
              >
                {next.title} &rarr;
              </Link>
            ) : (
              <span />
            )}
          </nav>
        )}
      </article>
    </div>
  );
}
