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
        surface: "#ffffff",
        muted: "#f1f5f9",
        border: "#e2e8f0",
        ink: "#0f172a",
        subtle: "#64748b",
        success: "#16a34a",
        warning: "#d97706",
        danger: "#dc2626",
      },
    },
  },
  plugins: [],
};
