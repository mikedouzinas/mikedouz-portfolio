export interface MemoryBubbleData {
  type: "memory";
  id: string;
  photos: string[];
  caption?: string;
  location?: string;
  year?: number;
  song?: {
    title: string;
    artist: string;
    previewUrl: string;
  };
}

export type DefinitionKind = "clarification" | "reference" | "aside";

export interface DefinitionCardData {
  type: "definition";
  id: string;
  term: string;
  definition: string;
  source?: string;
  greek?: string;
  link?: string;
  kind?: DefinitionKind;
  notitle?: boolean;
}

export type HoverCardData = MemoryBubbleData | DefinitionCardData;

export const hoverCards: Record<string, HoverCardData> = {
  barcelona: {
    type: "memory",
    id: "barcelona",
    photos: [
      "/images/memories/barcelona-1.png",
      "/images/memories/barcelona-2.png",
      "/images/memories/barcelona-3.png",
    ],
    caption: "Barcelona, Fall 2025",
    location: "Barcelona",
    year: 2025,
  },
  barca: {
    type: "memory",
    id: "barca",
    photos: [
      "/images/memories/barca-1.jpeg",
      "/images/memories/barca-2.jpeg",
      "/images/memories/barca-3.jpeg",
    ],
    caption: "Camp Nou",
    location: "Barcelona",
    year: 2025,
  },
  greek: {
    type: "memory",
    id: "greek",
    photos: [
      "/images/memories/greece-1.jpeg",
      "/images/memories/greece-2.jpeg",
      "/images/memories/greece-3.png",
    ],
    caption: "Greece",
    location: "Greece",
  },
  rice: {
    type: "memory",
    id: "rice",
    photos: ["/images/memories/rice-1.jpeg"],
    caption: "Rice University, IM flag football",
    location: "Houston",
  },
  "veson-nautical": {
    type: "memory",
    id: "veson-nautical",
    photos: [
      "/images/memories/veson-1.JPG",
      "/images/memories/veson-2.png",
    ],
    caption: "Where it started",
  },
  "veson-redwing": {
    type: "memory",
    id: "veson-redwing",
    photos: [
      "/images/memories/veson-redwing.jpeg",
    ],
    caption: "Veson Nautical",
  },
  "good-life": {
    type: "definition",
    id: "good-life",
    term: "Eudaimonia",
    greek: "εὐδαιμονία",
    definition:
      "The condition of human flourishing or of living well. The highest human good, achieved not through pleasure or wealth, but through virtuous activity of the soul in accordance with excellence, over a complete life.",
    source: "Aristotle, Nicomachean Ethics, Book I",
  },
  "iron-sharpens-iron": {
    type: "definition",
    id: "iron-sharpens-iron",
    term: "Iron Sharpens Iron",
    definition:
      "As iron sharpens iron, so one person sharpens another.",
    source: "Proverbs 27:17",
  },
  "veson-nautical-def": {
    type: "definition",
    id: "veson-nautical-def",
    term: "Veson Nautical",
    definition:
      "My parents co-founded Veson Nautical in 2001, combining my grandfathers' shipping software legacies — Veson Inc. and Nautical Technology Corp. It grew from their small Boston apartment into a global maritime platform. I built the company's first mobile app, 20 years after they started it.",
    link: "https://veson.com",
    kind: "reference",
  },
};
