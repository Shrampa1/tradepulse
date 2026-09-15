/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // Brand + semantic colors shared across the app so status badges,
        // buttons, and cards all draw from one palette.
        brand: {
          50: "#eff6ff",
          100: "#dbeafe",
          500: "#2563eb",
          600: "#1d4ed8",
          700: "#1e40af",
        },
        // Space-separated RGB CSS variables (defined in src/global.css, with
        // a `.dark:root` override) so these four tokens follow the app's
        // light/dark theme everywhere they're already used.
        surface: "rgb(var(--color-surface) / <alpha-value>)",
        muted: "rgb(var(--color-muted) / <alpha-value>)",
        border: "rgb(var(--color-border) / <alpha-value>)",
        ink: "rgb(var(--color-ink) / <alpha-value>)",
        subtle: "rgb(var(--color-subtle) / <alpha-value>)",
        success: "#16a34a",
        warning: "#d97706",
        danger: "#dc2626",
      },
    },
  },
  plugins: [],
};
