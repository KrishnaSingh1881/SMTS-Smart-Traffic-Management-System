import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: ["class", '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        clay: {
          bg: "var(--clay-bg)",
          surface: "var(--clay-surface)",
          border: "var(--clay-border)",
          text: "var(--clay-text)",
          muted: "var(--clay-muted)",
          accent: "var(--clay-accent)",
          success: "var(--clay-success)",
          warning: "var(--clay-warning)",
          danger: "var(--clay-danger)",
        },
      },
      borderRadius: {
        clay: "var(--clay-border-radius)",
        "clay-lg": "var(--clay-border-radius-lg)",
      },
      boxShadow: {
        clay: "var(--clay-shadow)",
        "clay-inset": "var(--clay-shadow-inset)",
      },
      backdropBlur: {
        clay: "var(--clay-blur)",
      },
    },
  },
  plugins: [],
};

export default config;
