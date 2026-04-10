import { Metadata } from 'next';
import MouseGlow from '@/components/mouse_glow';
import WebPattern from './components/WebPattern';

export const metadata: Metadata = {
  title: 'The Web | Mike Veson',
  description: 'Research, philosophy, and thinking — one stream.',
  openGraph: {
    title: 'The Web | Mike Veson',
    description: 'Research, philosophy, and thinking — one stream.',
    url: 'https://mikeveson.com/the-web',
    siteName: 'Mike Veson',
    type: 'website',
  },
};

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <MouseGlow color="#2dd4bf" />
      <WebPattern />
      {children}
    </>
  );
}
