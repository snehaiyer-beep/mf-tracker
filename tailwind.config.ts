import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      // Hex (not CSS vars) so Tailwind opacity modifiers like bg-surface2/50 work.
      // Keep in sync with the variables in app/globals.css.
      colors: {
        bg: "#070b16",
        surface: "#0e1528",
        surface2: "#141d36",
        line: "#1e2a4a",
        ink: "#e6eaf5",
        muted: "#8b95b3",
        faint: "#5b6585",
        up: "#34d399",
        down: "#fb7185",
        accent: "#3987e5",
      },
    },
  },
  plugins: [],
};
export default config;
