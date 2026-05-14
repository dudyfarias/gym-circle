/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        "gc-bg": "#000000",
        "gc-bg-elevated": "#050607",
        "gc-brand": "#8af7ff",
        "gc-brand-soft": "#c7fcff",
        "gc-brand-deep": "#30d5ff",
        "gc-brand-glow": "rgba(92, 232, 255, 0.42)",
        "gc-brand-ink": "#061116",
        "gc-pink": "#ff2d55",
        "gc-separator": "rgba(255, 255, 255, 0.06)",
        "gc-separator-strong": "rgba(255, 255, 255, 0.10)",
        "gc-fg": "#ffffff",
        "gc-fg-muted": "rgba(255, 255, 255, 0.52)",
        "gc-fg-soft": "rgba(255, 255, 255, 0.42)",
        "gc-fg-faint": "rgba(255, 255, 255, 0.28)",
      },
      fontFamily: {
        sans: ["System"],
      },
    },
  },
  plugins: [],
};
