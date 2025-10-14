// Static knowledge base for Iris command palette
// Maps question IDs to answers based on Mike's portfolio information

export const knowledgeBase: Record<string, string> = {
  "current-work": `I'm currently focused on building **Playground** - a comprehensive platform for creative problem-solving and project development. I'm also working on **Rack Rush v2**, an enhanced word game with improved gameplay mechanics and user experience. Both projects showcase my passion for creating engaging, user-centered applications.`,

  "rack-rush-30s": `**Rack Rush** is a fast-paced word game that challenges players to create words from letter tiles under time pressure. It features strategic gameplay with tile management, scoring systems, and competitive elements. Built with React and TypeScript, it demonstrates my ability to create engaging interactive experiences with clean, maintainable code.`,

  "frontend-experience": `I bring **full-stack versatility** with strong frontend expertise in React, TypeScript, and modern web technologies. My experience spans mobile and web development, with a focus on user-first design and performance optimization. I've built everything from gaming interfaces to data analytics tools, always prioritizing clean code and exceptional user experiences.`,

  "motivation": `I'm driven by the opportunity to **transform ideas into products that meaningfully help people at scale**. Growing up around shipping software taught me how technology can transform industries. I love breaking down complex problems, learning fast, and building solutions that connect customer needs to rapid, quality output.`,

  // "playground-projects": `**Playground** showcases my range across different domains - from interactive games like Rack Rush to data analytics tools for soccer predictions (where I reached **top 3% in Euro 2024**). Each project demonstrates different technical skills while maintaining focus on user experience and practical impact.`,

  "contact": `Let's connect! You can reach me through LinkedIn, GitHub, or email. I'm particularly interested in opportunities in **big tech**, **finance**, **shipping**, or any space where fast learners who bridge **customer needs** with **fast output** add value. Currently studying abroad in Barcelona 🇪🇸 while exploring new challenges.`,

  "secret-playbook": `There might be a way to find it 👀... Keep exploring the site and you might discover something special. Sometimes the best discoveries come from those who dig a little deeper into the details.`,

  // Add more static answers here:
  "education-background": `I have a strong foundation in computer science and software engineering, with hands-on experience building real-world applications. My learning journey has been focused on practical problem-solving and staying current with modern technologies. I believe in continuous learning and have pursued both formal education and self-directed learning to build expertise in full-stack development.`,

  "remote-work": `Absolutely! I'm very comfortable with remote work and have experience collaborating effectively with distributed teams. I'm currently studying abroad in Barcelona while working on projects, which has given me great experience with remote communication and time zone management. I'm open to hybrid, fully remote, or on-site opportunities depending on the role and team needs.`,

  "salary-expectations": `I'm open to discussing compensation based on the role, responsibilities, and company. I value opportunities for growth, learning, and meaningful impact. Let's have a conversation about how I can contribute to your team, and we can discuss compensation that's fair for both parties based on market rates and the value I bring.`,

  "default": `I can tell you about my projects, experience, and values. Try one of the suggestions above to learn more about my work, motivations, or how we might collaborate!`
};

// Note: Static suggestions moved to /data/iris/suggestions.ts
// This file now only contains the knowledge base for fallback answers

// Function to find matching answer (simplified - no more suggestion matching)
export function findAnswer(query: string): string {
  const normalizedQuery = query.toLowerCase().trim();
  
  // Simple keyword matching against knowledge base keys
  for (const [key, answer] of Object.entries(knowledgeBase)) {
    if (key !== 'default' && normalizedQuery.includes(key.replace('-', ' '))) {
      return answer;
    }
  }
  
  // Fuzzy matching for common patterns
  if (normalizedQuery.includes('work') && normalizedQuery.includes('current')) {
    return knowledgeBase['current-work'];
  }
  if (normalizedQuery.includes('contact') || normalizedQuery.includes('reach')) {
    return knowledgeBase['contact'];
  }
  if (normalizedQuery.includes('motivat') || normalizedQuery.includes('drive')) {
    return knowledgeBase['motivation'];
  }
  if (normalizedQuery.includes('rack rush') || normalizedQuery.includes('game')) {
    return knowledgeBase['rack-rush-30s'];
  }
  
  return knowledgeBase.default;
}
