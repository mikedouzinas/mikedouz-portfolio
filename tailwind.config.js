/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx}",
    "./src/components/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        primaryBlue: "#002a4a",
        secondaryBlue: "#283e80",
        accentOrange: "#ff7f32",
      },
    },
  },
  plugins: []
};
