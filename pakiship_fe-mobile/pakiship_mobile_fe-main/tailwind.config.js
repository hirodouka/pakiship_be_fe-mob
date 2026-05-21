/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./App.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#39B5A8",
        secondary: "#1A5D56",
        accent: "#FDB833",
        background: "#F0F9F8",
        dark: "#041614",
      },
    },
  },
  plugins: [],
}
 
