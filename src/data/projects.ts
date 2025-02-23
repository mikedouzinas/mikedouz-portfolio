// src/data/projects.ts

export interface Project {
  id: string;
  imageUrl?: string;
  title: string;
  description: string;
  githubLink: string;
  projectLink?: string;
  skills?: string[];
}

export const projects: Project[] = [
  {
    id: "1",
    imageUrl: "/project1.png",
    title: "Euros 2024 Predictor",
    description:
      "I developed a machine learning project to predict outcomes for Euro 2024 matches by web scraping comprehensive datasets and processing them with Pandas. Using a RandomForestClassifier, the model forecasts expected goals and final scores, landing in the top ~3% of UEFA predictions.",
    githubLink: "https://github.com/mikedouzinas/euros-predictor",
    skills: ["Python", "Pandas", "RandomForestClassifier", "Web Scraping"],
  },
  {
    id: "2",
    imageUrl: "/project2.png",
    title: "BB&N's Knight Life",
    description:
      "I developed and launched BB&N's Knight Life, a mobile app that streamlines school scheduling for Buckingham Browne & Nichols School. Built in Swift with an intuitive interface, the app quickly gained traction—over half of the high school students adopted it and it earned a 4.9-star rating on the App Store.",
    githubLink: "https://github.com/mikedouzinas/BBN-Knight-Life",
    projectLink: "https://apps.apple.com/us/app/bb-ns-knight-life/id1585503654",
    skills: ["Swift", "Firebase", "User-Centered Design", "Product Management"],
  },
  {
    id: "3",
    imageUrl: "/project3.png", // Consider using an app mockup or a waveform visualization as the image
    title: "Momentum",
    description:
      "Momentum is a SwiftUI-powered iOS app that captures and transcribes audio in real-time, integrates advanced Text-to-Speech, and leverages OpenAI's GPT-4 to process voice commands for tasks like reminders, calendar events, and to-do lists. The adaptive TTS system ensures low latency and seamless speech output, optimizing response quality through predictive modeling.",
    githubLink: "https://github.com/mikedouzinas/momentum",
    skills: [
      "SwiftUI",
      "Speech Recognition",
      "Text-to-Speech (TTS)",
      "Predictive Modeling",
      "AI Task Automation",
    ],
  },  
  {
    id: "4",
    imageUrl: "/project4.png", // Placeholder image, see suggestions below
    title: "Personal Portfolio",
    description:
      "Designed and developed a full-stack personal portfolio using Next.js, TypeScript, and Tailwind CSS, showcasing projects, experience, and skills. Integrated dark mode, smooth animations with Framer Motion, and accessibility enhancements for an optimized user experience.",
    githubLink: "https://github.com/mikedouzinas/mikedouz-portfolio",
    skills: ["Next.js", "TypeScript", "Tailwind CSS", "Framer Motion", "UI/UX Design"],
  },
];
