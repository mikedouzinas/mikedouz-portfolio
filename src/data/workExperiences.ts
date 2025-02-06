// src/data/workExperiences.ts

export interface WorkExperience {
    id: string;
    title: string;
    company: string;
    period: string;
    description: string;
    imageUrl: string;
    skills: string[];
  }
  
  /**
   * Work Experiences (summarized 2-3 sentences each).
   * Adjust the imageUrl paths to match your public/ folder images.
   */
  export const workExperiences: WorkExperience[] = [
    {
      id: "1",
      title: "Software Engineer in Residence",
      company: "Liu Idea Lab for Innovation & Entrepreneurship",
      period: "Feb 2024 - Nov 2024",
      description:
        "Led full-stack software solutions at Lilie, implementing robust front-end and back-end systems to foster innovation among Rice University students. Focused on scalable architecture, streamlined user experiences, and mobile integration to meet diverse user needs.",
      imageUrl: "/lilie_logo.png",
      skills: ["Entrepreneurship", "Innovation", "Full Stack", "Node.js", "React"],
    },
    {
      id: "2",
      title: "Software Engineering Intern",
      company: "Veson Nautical · Internship",
      period: "Jun 2024 - Sep 2024",
      description:
        "Created automated laytime calculations using Google Document AI, drastically cutting multi-day manual processes to minutes. Collaborated with major clients to refine shipping workflows, ensuring accurate demurrage cost calculations and maritime compliance.",
      imageUrl: "/veson.png",
      skills: ["Python", "FastAPI", "Document AI", "Docker", "Client Engagement"],
    },
    {
      id: "3",
      title: "Data Science Intern",
      company: "VesselsValue",
      period: "May 2024 - Jun 2024",
      description:
        "Developed advanced NLP solutions using BERT sentence transformers, accurately categorizing over 100,000 contact job titles. Optimized directory merging with FAISS-based similarity searches, boosting match precision by over 20%.",
      imageUrl: "/vessels_value.png",
      skills: ["Machine Learning", "NLP", "BERT", "FAISS", "Python"],
    },
    {
      id: "4",
      title: "Software Development Intern",
      company: "Veson Nautical",
      period: "Jun 2021 - Jun 2023",
      description:
        "Helped build Veson Nautical’s first mobile app in Swift, providing real-time shipping data to enterprise clients. Gathered feedback in sprints, integrated changes quickly, and ensured a smooth user experience throughout development.",
      imageUrl: "/veson.png",
      skills: ["Swift", "Xcode", "Mobile Dev", "Agile", "Atlassian Suite"],
    },
  ];
  