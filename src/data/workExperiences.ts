// src/data/workExperiences.ts

export interface WorkExperience {
    id: string;
    title: string;
    company: string;
    period: string;
    description: string;
    companyUrl: string;
    skills: string[];
  }
  
  /**
   * Work Experiences (summarized 2-3 sentences each).
   * Adjust the companyUrl paths to match your public/ folder images.
   */
  export const workExperiences: WorkExperience[] = [
    {
      id: "1",
      title: "Software Engineer Intern",
      company: "Parsons Corporation",
      period: "MAY - AUG 2025",
      description:
        "Developed and improved services in C#/.NET that integrated external APIs with SQL databases and AWS infrastructure, powering Power BI dashboards for U.S. Air Force users.",
      companyUrl: "https://www.parsons.com/",
      skills: ["C#", ".NET", "SQL", "AWS", "PowerBI","APIs", "Data Integration"],
    },
    {
      id: "2",
      title: "Software Engineer in Residence",
      company: "Liu Idea Lab for Innovation & Entrepreneurship",
      period: "FEB - NOV 2024",
      description:
        "Led full-stack software solutions at Lilie, implementing robust front-end and back-end systems to foster innovation among Rice University students. Focused on scalable architecture, streamlined user experiences, and mobile integration to meet diverse user needs.",
      companyUrl: "https://entrepreneurship.rice.edu/",
      skills: ["Entrepreneurship", "Innovation", "Full Stack", "Node.js", "React"],
    },
    {
      id: "3",
      title: "Software Engineering Intern",
      company: "Veson Nautical",
      period: "JUN - SEP 2024",
      description:
        "Created automated laytime calculations using Google Document AI, drastically cutting multi-day manual processes to minutes. Collaborated with major clients to refine shipping workflows, ensuring accurate demurrage cost calculations and maritime compliance.",
      companyUrl: "https://veson.com/",
      skills: ["Python", "FastAPI", "Document AI", "Docker", "Client Engagement"],
    },
    {
      id: "4",
      title: "Data Science Intern",
      company: "VesselsValue",
      period: "MAY - JUN 2024",
      description:
        "Developed advanced NLP solutions using BERT sentence transformers, accurately categorizing over 100,000 contact job titles. Optimized directory merging with FAISS-based similarity searches, boosting match precision by over 20%.",
      companyUrl: "https://www.vesselsvalue.com/",
      skills: ["Machine Learning", "NLP", "BERT", "FAISS", "Python"],
    },
    {
      id: "5",
      title: "Software Development Intern",
      company: "Veson Nautical",
      period: "2021 - 2023",
      description:
        "Helped build Veson Nautical's first mobile app in Swift, providing real-time shipping data to enterprise clients. Gathered feedback in sprints, integrated changes quickly, and ensured a smooth user experience throughout development.",
      companyUrl: "https://veson.com/",
      skills: ["Swift", "Xcode", "Mobile Dev", "Agile", "Atlassian Suite"],
    },
  ];
  