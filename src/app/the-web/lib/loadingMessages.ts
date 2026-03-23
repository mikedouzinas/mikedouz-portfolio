/**
 * Loading messages for Blog Iris interactions.
 * Lowercase sentence fragments matching WebLoader tone.
 * Web/thread metaphors fitting the blog's spider-web identity.
 */

const BLOG_IRIS_LOADING_MESSAGES = [
  "weaving thoughts together...",
  "spinning up the web...",
  "pulling threads...",
  "following the signal...",
  "untangling the web...",
  "loading thoughts...",
  "sorting meaning from noise...",
  "the web is wide. give me a moment.",
  "connecting the dots...",
  "tracing the thread...",
  "okay, let's do this one more time...",
  "that's all it is. a leap of faith.",
  "smoothing out the rough edges...",
  "one sec, thinking...",
] as const;

export function getRandomBlogLoadingMessage(): string {
  return BLOG_IRIS_LOADING_MESSAGES[
    Math.floor(Math.random() * BLOG_IRIS_LOADING_MESSAGES.length)
  ];
}
