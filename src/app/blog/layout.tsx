import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'The Web | Mike Veson',
  description: 'Research, philosophy, and thinking — one stream.',
  openGraph: {
    title: 'The Web | Mike Veson',
    description: 'Research, philosophy, and thinking — one stream.',
    url: 'https://mikeveson.com/blog',
    siteName: 'Mike Veson',
    type: 'website',
  },
};

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return children;
}
