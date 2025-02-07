// src/data/projects.ts

export interface Project {
    id: string;
    title: string;
    description: string;
    githubLink: string;
    projectLink?: string;
    skills?: string[];
  }
  
  export const projects: Project[] = [
    {
      id: "1",
      title: "Euros 2024 Predictor",
      description:
        "I developed a machine learning project to predict outcomes for Euro 2024 matches by web scraping comprehensive datasets and processing them with Pandas. Using a RandomForestClassifier, the model forecasts expected goals and final scores, landing in the top ~3% of UEFA predictions.",
      githubLink: "https://github.com/mikedouzinas/euros-predictor",
      projectLink: "", // Optional: provide a live link if available.
      skills: ["Python", "Pandas", "RandomForestClassifier", "Web Scraping"],
    },
    {
      id: "2",
      title: "BB&N's Knight Life",
      description:
        "I developed and launched BB&N's Knight Life, a mobile app that streamlines school scheduling for Buckingham Browne & Nichols School. Built in Swift with an intuitive interface, the app quickly gained traction—over half of the high school students adopted it and it earned a 4.9-star rating on the App Store.",
      githubLink: "https://github.com/mikedouzinas/BBN-Knight-Life",
      projectLink: "https://apps.apple.com/us/app/bb-ns-knight-life/id1585503654",
      skills: ["Swift", "Firebase", "User-Centered Design", "Product Management"],
    },
  ];
  