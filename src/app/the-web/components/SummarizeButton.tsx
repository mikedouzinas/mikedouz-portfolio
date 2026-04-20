'use client';

import ContainedMouseGlow from '@/components/ContainedMouseGlow';

interface SummarizeButtonProps {
  slug: string;
  postTitle: string;
}

export default function SummarizeButton({ slug, postTitle }: SummarizeButtonProps) {
  const handleClick = () => {
    window.dispatchEvent(new CustomEvent('blog-iris-summarize', { detail: { slug, postTitle } }));
  };

  return (
    <button
      onClick={handleClick}
      data-suppress-web="true"
      data-has-contained-glow="true"
      className="relative isolate inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg overflow-hidden transition-transform duration-200 hover:scale-[1.05] text-[11px] font-semibold tracking-wide"
      style={{
        color: '#6ee7b7',
        background: 'rgba(16,42,46,0.75)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(52,211,153,0.25)',
        boxShadow: '0 8px 20px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.08)',
      }}
    >
      <ContainedMouseGlow color="52, 211, 153" intensity={0.25} />

      <span className="relative">summarize</span>
      <svg width="13" height="13" viewBox="0 0 23.2793 22.7815" fill="none" className="relative" aria-hidden>
        <path
          d="M17.8389 16.3087L17.8389 22.0275C17.8389 22.7541 18.542 22.9962 19.1357 22.5744L22.9248 19.8634C23.4014 19.5275 23.3936 18.8322 22.9248 18.4962L19.1357 15.7541C18.5186 15.3009 17.8389 15.5666 17.8389 16.3087ZM19.2529 19.9181C19.6748 19.9181 20.0186 19.5666 20.0186 19.1525C20.0186 18.7306 19.6748 18.3869 19.2529 18.3869L8.32325 18.3869C4.47169 18.3869 2.40919 16.3244 2.40919 12.6447L2.40919 3.54311C2.40919 3.12905 2.06544 2.7853 1.64356 2.7853C1.2295 2.7853 0.877936 3.12905 0.877936 3.54311L0.877936 12.6291C0.877936 17.3009 3.48731 19.9181 8.32325 19.9181Z"
          fill="currentColor"
        />
        <path
          d="M7.30762 4.21499L18.7529 4.21499C19.1592 4.21499 19.4795 3.88686 19.4795 3.48061C19.4795 3.06655 19.1592 2.74624 18.7529 2.74624L7.30762 2.74624C6.89356 2.74624 6.57325 3.06655 6.57325 3.48061C6.57325 3.88686 6.89356 4.21499 7.30762 4.21499ZM7.30762 9.21499L18.7529 9.21499C19.1592 9.21499 19.4795 8.89468 19.4795 8.48843C19.4795 8.07436 19.1592 7.75405 18.7529 7.75405L7.30762 7.75405C6.89356 7.75405 6.57325 8.07436 6.57325 8.48843C6.57325 8.89468 6.89356 9.21499 7.30762 9.21499ZM7.30762 14.2228L13.6045 14.2228C14.0186 14.2228 14.3389 13.9025 14.3389 13.4884C14.3389 13.0822 14.0186 12.7541 13.6045 12.7541L7.30762 12.7541C6.89356 12.7541 6.57325 13.0822 6.57325 13.4884C6.57325 13.9025 6.89356 14.2228 7.30762 14.2228Z"
          fill="currentColor"
        />
      </svg>
    </button>
  );
}
