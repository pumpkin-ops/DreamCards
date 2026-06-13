/** @type {import('tailwindcss').Config} */
export default {
  content: ["./frontend/index.html", "./frontend/src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        void: "#080a12",
        obsidian: "#101422",
        aurora: "#6ee7f9",
        ember: "#f97316",
        dream: "#a78bfa"
      },
      boxShadow: {
        card: "0 18px 60px rgba(0,0,0,0.35)",
        glow: "0 0 36px rgba(167,139,250,0.35)"
      }
    }
  },
  plugins: []
};
