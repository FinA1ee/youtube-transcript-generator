import type { Config } from "tailwindcss";

export default {
  content: ["./src/client/react/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "sans-serif"],
        display: ["Georgia", "ui-serif", "serif"]
      },
      colors: {
        ink: "#18202f",
        paper: "#f7f5ef",
        panel: "#fffdf8",
        line: "#d8d2c4",
        accent: "#0f766e",
        signal: "#b45309"
      }
    }
  },
  plugins: []
} satisfies Config;
