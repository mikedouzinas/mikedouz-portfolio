// src/data/about.ts
import React from "react";

export interface AboutSlide {
  img: string;
  alt: string;
  text: React.ReactNode;
}

export const aboutSlides: AboutSlide[] = [
  {
    img: "/about1.png",
    alt: "Photo 1",
    text: (
      <>
        I grew up in a <span className="font-semibold">startup environment</span>, watching my parents build{" "}
        <span className="font-semibold">Veson Nautical</span> from an idea into a global company. Being surrounded by{" "}
        <span className="font-semibold">problem-solving</span> and <span className="font-semibold">iteration</span>{" "}
        taught me that <span className="font-semibold">great products come from real-world understanding, not just code.</span>
      </>
    ),
  },
  {
    img: "/about2.JPG",
    alt: "Photo 2",
    text: (
      <>
        Being <span className="font-semibold">Greek</span> isn’t just heritage—it’s <span className="font-semibold">identity</span>. 
        Summers in <span className="font-semibold">Greece</span>, speaking the language, and immersing in traditions shaped how I see the world. 
        My background influences my <span className="font-semibold">perspective, my connections, and my approach to challenges</span>, 
        always balancing <span className="font-semibold">logic with storytelling.</span>
      </>
    ),
  },
  {
    img: "/about3.JPG",
    alt: "Photo 3",
    text: (
      <>
        I've always been passionate about <span className="font-semibold">soccer</span>—playing, watching, and analyzing it. 
        As a <span className="font-semibold">Barcelona fan</span>, I love the <span className="font-semibold">strategy and precision</span> behind the game. 
        That passion led me to <span className="font-semibold">sports analytics</span>, where I use{" "}
        <span className="font-semibold">software to evaluate player performance</span> and optimize tactics.
      </>
    ),
  },
  {
    img: "/about4.jpeg",
    alt: "Photo 4",
    text: (
      <>
        This is <span className="font-semibold">Poros</span>, the island where my <span className="font-semibold">grandfather was born</span>. 
        Coming here always gives me <span className="font-semibold">perspective</span>—a place to <span className="font-semibold">reflect, reset, and think big.</span>
        Some of my best ideas have come from moments like this, away from screens and in <span className="font-semibold">deep thought.</span>
      </>
    ),
  },
  {
    img: "/about5.jpeg",
    alt: "Photo 5",
    text: (
      <>
        I’ve always been a <span className="font-semibold">morning person</span>. 
        There’s something about the quiet energy of the morning, the fresh start, and the time to think before the world fully wakes up. 
        Whether I’m walking to work, grabbing coffee, or planning my day, mornings give me clarity and focus. 
        That daily rhythm—moving through the city, setting intentions—keeps me <span className="font-semibold">driven and ready to build.</span>
      </>
    ),
  },
];
