/**
 * Collection of quotes that resonate with me and why they matter
 */
export interface Quote {
  text: string;
  why: string;
  author?: string;
}

export const quotes: Quote[] = [
  {
    text: "Creativity is intelligence having fun.",
    why: "This reminds me that the best work happens when I'm genuinely enjoying the process. When I stop overthinking and start playing with ideas, that's when breakthrough moments happen.",
    author: "Albert Einstein"
  },
  {
    text: "The best time to plant a tree was 20 years ago. The second best time is now.",
    why: "Perfect for overcoming the regret of not starting sooner. Whether it's learning a skill, building a habit, or starting a project—the important thing is to begin today.",
    author: "Chinese Proverb"
  },
  {
    text: "You miss 100% of the shots you don't take.",
    why: "Simple but profound. It's easy to rationalize inaction, but the only guaranteed failure is not trying. This pushes me to take calculated risks and put myself out there.",
    author: "Wayne Gretzky"
  },
  {
    text: "Done is better than perfect.",
    why: "As a perfectionist, this is my reminder to ship things. Perfect is the enemy of good, and good shipped is better than perfect never released. Progress over perfection.",
    author: "Sheryl Sandberg"
  },
  {
    text: "Be curious, not judgmental.",
    why: "From Ted Lasso, but the wisdom is timeless. When I approach people and situations with genuine curiosity instead of preformed judgments, I learn more and connect better.",
    author: "Ted Lasso"
  },
  {
    text: "What you do speaks so loudly that I cannot hear what you say.",
    why: "Actions reveal true character and priorities. It's a reminder to align my actions with my values, and to judge others by what they do rather than what they claim.",
    author: "Ralph Waldo Emerson"
  },
  {
    text: "The master has failed more times than the beginner has even tried.",
    why: "Failure is just data. Mastery comes from iterating, not from avoiding mistakes. This reframes failure from something to fear into something that indicates I'm pushing boundaries.",
    author: "Stephen McCranie"
  },
  {
    text: "If you want to go fast, go alone. If you want to go far, go together.",
    why: "Solo work can feel efficient, but the best outcomes come from collaboration. Building something meaningful requires other people—their skills, perspectives, and energy.",
    author: "African Proverb"
  },
  {
    text: "Code is read more than it's written.",
    why: "This shapes how I approach programming. Writing clear, maintainable code isn't just about making it work—it's about making it understandable for the next person (often future me).",
    author: "Robert C. Martin"
  },
  {
    text: "Progress, not perfection.",
    why: "My personal mantra for staying motivated. Small, consistent improvements compound over time. It's better to get 1% better each day than to wait for the perfect moment to make a big change."
  }
];