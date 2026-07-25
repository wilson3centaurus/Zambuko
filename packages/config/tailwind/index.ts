import type { Config } from "tailwindcss";

// Shared Tailwind config — extend this in each app
const config: Omit<Config, "content"> = {
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Hutano healthcare palette — calm teal primary with a warm accent.
        brand: {
          50:  "#effbfb",
          100: "#d6f3f4",
          200: "#b1e5e8",
          300: "#7fd1d6",
          400: "#47b3bb",
          500: "#278f99",
          600: "#1a6e7e",
          700: "#175967",
          800: "#174955",
          900: "#163d47",
          950: "#07252c",
        },
        accent: {
          50: "#fff8f1",
          100: "#ffead7",
          200: "#ffd1ae",
          300: "#ffae78",
          400: "#f98a47",
          500: "#f07038",
          600: "#d95520",
          700: "#b5401a",
        },
        emergency: {
          50:  "#fff1f2",
          100: "#ffe4e6",
          200: "#fecdd3",
          400: "#fb7185",
          500: "#f43f5e",
          600: "#e11d48",
          700: "#be123c",
        },
        success: {
          50:  "#f0fdf4",
          500: "#22c55e",
          600: "#16a34a",
        },
        warning: {
          50:  "#fffbeb",
          400: "#fbbf24",
          500: "#f59e0b",
          600: "#d97706",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
      },
      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.5rem",
      },
      boxShadow: {
        card: "0 1px 2px rgb(15 23 42 / 0.04)",
        "card-hover": "0 10px 24px -12px rgb(15 23 42 / 0.28)",
        emergency: "0 0 0 4px rgb(244 63 94 / 0.3)",
      },
      animation: {
        "pulse-emergency": "pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "fade-in": "fadeIn 0.2s ease-in-out",
        "slide-up": "slideUp 0.3s ease-out",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { transform: "translateY(1rem)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
