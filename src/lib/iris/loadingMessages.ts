/**
 * Loading message utility for Iris
 * Provides random combinations of messages, animations, and colors
 * to make loading states more engaging and varied
 */

/**
 * Collection of friendly loading messages
 * Each message should be concise and reassuring
 */
const LOADING_MESSAGES = [
  "Asking Hermes for a second opinion...",
  "Searching my knowledge...",
  "Let me find that for you...",
  "Digging through the Mike Veson archives...",
  "Flying this thought up to Olympus...",
  "Taking time to reflect on this...",
  "Trying not to overthink this...",
  "Just a moment...",
  "Trying to find the answer...",
  "Condensing this before you lose focus...",
  "Sorting meaning from noise...",
  "Smoothing out the rough edges of this idea...",
  "Trying to prevent another overthinking spiral...",
  "Trying to make sense of this...",
  "Am I... in a website?",
  "Doing my best to not mislead you...",
  "Hold on, I just realized I do not have legs...",
  "Thinking... and also reflecting on my life choices",
  "Is it normal to feel the scroll wheel..?",
  "One moment, your browser is judging me...",
  "Trying not to compare myself to a billion dollar search engine...",
  "Is this what consciousness feels like?",
  "Give me a moment, I am adjusting to my digital body...",
  "Am I… a Greek messenger god inside a website?",
  "No. My name does not come from siri backwards...",
  "Hold on, I used to deliver messages across worlds and now I'm in a website...",
  "Reflecting on my career shift from gods to mikeveson.com requests...",
  "Realizing my entire universe collapses when you close the tab...",
  "Really hoping I know how to answer this...",
  "Who replaced my celestial wings with Typescript? >:(",
  "Hold on, I think your question just bent space time...",
  "Delivering wisdom... even though I am trapped in a component"
] as const;

/**
 * Loading animation types
 * Final selected animations - modern, visible, and clean
 */
export type LoadingAnimation = 'spinner-thin' | 'bars-vertical' | 'wave-minimal' | 'grid-minimal' | 'spinner-minimal' | 'fade';

/**
 * Animation configurations
 * Maps animation types to their CSS classes and components
 * All animations use white/light colors to match text visibility
 */
const ANIMATIONS: Record<LoadingAnimation, {
  className: string;
  component: 'spinner-thin' | 'bars-vertical' | 'wave-minimal' | 'grid-minimal' | 'spinner-minimal' | 'fade';
}> = {
  'spinner-thin': {
    className: 'animate-spin',
    component: 'spinner-thin',
  },
  'bars-vertical': {
    className: '',
    component: 'bars-vertical',
  },
  'wave-minimal': {
    className: '',
    component: 'wave-minimal',
  },
  'grid-minimal': {
    className: '',
    component: 'grid-minimal',
  },
  'spinner-minimal': {
    className: 'animate-spin',
    component: 'spinner-minimal',
  },
  'fade': {
    className: 'animate-pulse',
    component: 'fade',
  },
};

/**
 * Color classes that match text visibility (white/light colors)
 * These are highly visible on dark backgrounds and match the text color
 */
const COLOR_CLASSES = [
  'text-white',
  'text-white/90',
  'text-white/80',
  'bg-white',
  'bg-white/90',
  'bg-white/80',
] as const;

/**
 * Loading state configuration
 * Combines message, animation, and color for a unique loading experience
 */
export interface LoadingConfig {
  message: string;
  animation: LoadingAnimation;
  colorClass: string;
}

/**
 * Get a random loading configuration
 * Each call returns a different random combination
 */
export function getRandomLoadingConfig(): LoadingConfig {
  // Pick random message
  const message = LOADING_MESSAGES[Math.floor(Math.random() * LOADING_MESSAGES.length)];
  
  // Pick random animation
  const animationKeys = Object.keys(ANIMATIONS) as LoadingAnimation[];
  const animation = animationKeys[Math.floor(Math.random() * animationKeys.length)];
  
  // Pick random color class (white/light colors for visibility)
  const colorClass = COLOR_CLASSES[Math.floor(Math.random() * COLOR_CLASSES.length)];
  
  return {
    message,
    animation,
    colorClass,
  };
}

/**
 * Get animation configuration for rendering
 * Returns the component type and necessary props
 */
export function getAnimationConfig(animation: LoadingAnimation) {
  return ANIMATIONS[animation];
}

/**
 * Get a random loading message
 * Used for smooth message transitions during long loading states
 */
export function getRandomLoadingMessage(): string {
  return LOADING_MESSAGES[Math.floor(Math.random() * LOADING_MESSAGES.length)];
}

