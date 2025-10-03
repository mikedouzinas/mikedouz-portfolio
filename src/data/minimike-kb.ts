// Static knowledge base for MiniMike command palette
// Maps question IDs to answers based on Mike's portfolio information

export const knowledgeBase: Record<string, string> = {
  "current-work": `I'm currently focused on building **Playground** - a comprehensive platform for creative problem-solving and project development. I'm also working on **Rack Rush v2**, an enhanced word game with improved gameplay mechanics and user experience. Both projects showcase my passion for creating engaging, user-centered applications.`,

  "rack-rush-30s": `**Rack Rush** is a fast-paced word game that challenges players to create words from letter tiles under time pressure. It features strategic gameplay with tile management, scoring systems, and competitive elements. Built with React and TypeScript, it demonstrates my ability to create engaging interactive experiences with clean, maintainable code.`,

  "frontend-experience": `I bring **full-stack versatility** with strong frontend expertise in React, TypeScript, and modern web technologies. My experience spans mobile and web development, with a focus on user-first design and performance optimization. I've built everything from gaming interfaces to data analytics tools, always prioritizing clean code and exceptional user experiences.`,

  "motivation": `I'm driven by the opportunity to **transform ideas into products that meaningfully help people at scale**. Growing up around shipping software taught me how technology can transform industries. I love breaking down complex problems, learning fast, and building solutions that connect customer needs to rapid, quality output.`,

  "playground-projects": `**Playground** showcases my range across different domains - from interactive games like Rack Rush to data analytics tools for soccer predictions (where I reached **top 3% in Euro 2024**). Each project demonstrates different technical skills while maintaining focus on user experience and practical impact.`,

  "contact": `Let's connect! You can reach me through LinkedIn, GitHub, or email. I'm particularly interested in opportunities in **big tech**, **finance**, **shipping**, or any space where fast learners who bridge **customer needs** with **fast output** add value. Currently studying abroad in Barcelona 🇪🇸 while exploring new challenges.`,

  "secret-playbook": `There might be a way to find it 👀... Keep exploring the site and you might discover something special. Sometimes the best discoveries come from those who dig a little deeper into the details.`,

  "default": `I can tell you about my projects, experience, and values. Try one of the suggestions above to learn more about my work, motivations, or how we might collaborate!`
};

// Base suggestions for the command palette
export const baseSuggestions = [
  { id: "current-work", text: "What is Mike working on right now?" },
  { id: "rack-rush-30s", text: "Tell me about Rack Rush in 30s." },
  { id: "frontend-experience", text: "Summarize his experience for a frontend team." },
  { id: "motivation", text: "What motivates Mike to build?" },
  { id: "playground-projects", text: "Show Playground projects." },
  { id: "contact", text: "How can I contact Mike?" },
  { id: "secret-playbook", text: "What's the secret Playbook?" }
];

// Function to find matching answer
export function findAnswer(query: string): string {
  const normalizedQuery = query.toLowerCase().trim();
  
  // Direct suggestion match
  const suggestion = baseSuggestions.find(s => 
    s.text.toLowerCase() === normalizedQuery
  );
  
  if (suggestion) {
    return knowledgeBase[suggestion.id];
  }
  
  // Fuzzy matching for partial queries
  const fuzzyMatch = baseSuggestions.find(s => {
    const suggestionWords = s.text.toLowerCase().split(' ');
    const queryWords = normalizedQuery.split(' ');
    
    return queryWords.some(qWord => 
      suggestionWords.some(sWord => 
        sWord.includes(qWord) || qWord.includes(sWord)
      )
    );
  });
  
  if (fuzzyMatch) {
    return knowledgeBase[fuzzyMatch.id];
  }
  
  return knowledgeBase.default;
}