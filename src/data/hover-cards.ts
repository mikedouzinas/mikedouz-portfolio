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
}

export type HoverCardData = MemoryBubbleData | DefinitionCardData;

export const hoverCards: Record<string, HoverCardData> = {
  barcelona: {
    type: "memory",
    id: "barcelona",
    photos: [
      "/images/memories/barcelona-1.jpg",
      "/images/memories/barcelona-2.jpg",
      "/images/memories/barcelona-3.jpg",
    ],
    caption: "Barcelona, Fall 2025",
    location: "Barcelona",
    year: 2025,
    song: {
      title: "TBD",
      artist: "TBD",
      previewUrl: "",
    },
  },
  barca: {
    type: "memory",
    id: "barca",
    photos: [
      "/images/memories/barca-1.jpg",
      "/images/memories/barca-2.jpg",
    ],
    caption: "Camp Nou",
    location: "Barcelona",
    year: 2025,
    song: {
      title: "TBD",
      artist: "TBD",
      previewUrl: "",
    },
  },
  rice: {
    type: "memory",
    id: "rice",
    photos: ["/images/memories/rice-1.jpg"],
    caption: "Rice University",
    location: "Houston",
  },
  "veson-nautical": {
    type: "memory",
    id: "veson-nautical",
    photos: [
      "/images/memories/veson-1.jpg",
      "/images/memories/veson-2.jpg",
    ],
    caption: "Where it started",
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
};
