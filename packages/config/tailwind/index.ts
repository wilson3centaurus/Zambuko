import type { Config } from "tailwindcss";

// Shared Tailwind config — extend this in each app
const config: Omit<Config, "content"> = {
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Zambuko brand colors
        brand: {
          50:  "#eff6ff",
          100: "#dbeafe",
          200: "#bfdbfe",
          300: "#93c5fd",
          400: "#60a5fa",
          500: "#3b82f6",
          600: "#2563eb",
          700: "#1d4ed8",
          800: "#1e40af",
          900: "#1e3a8a",
          950: "#172554",
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
        card: "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)",
        "card-hover": "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
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
