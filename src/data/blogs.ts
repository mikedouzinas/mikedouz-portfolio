export interface Blog {
    id: string;
    title: string;
    imageUrl: string;
    link: string;
  }
  
  export const blogs: Blog[] = [
    {
      id: "1",
      title: "What Are You Going to Do with Your Life?",
      imageUrl: "/blog1.jpeg", // place your image in public/
      link: "https://discovery.blogs.rice.edu/what-are-you-going-to-do-with-your-life/",
    }
  ];
  