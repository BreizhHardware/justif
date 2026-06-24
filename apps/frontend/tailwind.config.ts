import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#EFFBF4",
          100: "#D8EFD3",
          200: "#B7E4C7",
          400: "#40916C",
          500: "#2D6A4F",
          600: "#235A41",
          700: "#1A3D2B",
          900: "#0F2A1D",
        },
        justif: {
          green: "#2D6A4F",
          "green-light": "#D8EFD3",
          "green-dark": "#1A3D2B",
        },
      },
      boxShadow: {
        card: "0 1px 2px 0 rgb(0 0 0 / 0.04), 0 1px 6px -1px rgb(0 0 0 / 0.04)",
      },
    },
  },
  plugins: [],
} satisfies Config;
