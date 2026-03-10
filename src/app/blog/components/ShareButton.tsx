'use client';

import { useState } from 'react';

export default function ShareButton() {
  const [copied, setCopied] = useState(false);

  const handleClick = async () => {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleClick}
      className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
    >
      {copied ? 'copied!' : 'share link'}
    </button>
  );
}
