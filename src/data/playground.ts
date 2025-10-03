/**
 * Project metadata for playground items
 * Used to generate both the playground grid and individual project pages
 */
export interface PlaygroundProject {
  slug: string;
  name: string;
  blurb: string;
}

export const playgroundProjects: PlaygroundProject[] = [
  {
    slug: "rack-rush",
    name: "Rack Rush v2",
    blurb: "Faster, smarter, prettier."
  },
  {
    slug: "decision-maker", 
    name: "The Decision Maker",
    blurb: "Pick fast, explain why."
  },
  {
    slug: "ranked-by-mv",
    name: "Ranked by Mike", 
    blurb: "My Beli-style rating system."
  },
  {
    slug: "quotes",
    name: "Quotes by Mike",
    blurb: "Lines I live by—and why."
  }
];

/**
 * Get project by slug
 */
export function getProjectBySlug(slug: string): PlaygroundProject | undefined {
  return playgroundProjects.find(project => project.slug === slug);
}