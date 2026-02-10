
import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

export default {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        // Beach volleyball themed colors
        sand: {
          light: "hsl(45 45% 92%)",
          DEFAULT: "hsl(45 35% 88%)",
          dark: "hsl(25 25% 75%)",
        },
        ocean: {
          light: "hsl(200 85% 65%)",
          DEFAULT: "hsl(200 85% 45%)",
          dark: "hsl(220 75% 35%)",
        },
        sunset: {
          light: "hsl(25 95% 75%)",
          DEFAULT: "hsl(25 85% 65%)",
          dark: "hsl(25 75% 55%)",
        },
        coral: {
          light: "hsl(5 95% 75%)",
          DEFAULT: "hsl(5 85% 55%)",
          dark: "hsl(5 75% 45%)",
        },
        palm: {
          light: "hsl(120 40% 70%)",
          DEFAULT: "hsl(120 35% 45%)",
          dark: "hsl(120 30% 35%)",
        },
      },
      keyframes: {
        "slide-up": {
          "0%": { transform: "translateY(10px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        "slide-down": {
          "0%": { transform: "translateY(-10px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "bounce-gentle": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-5px)" },
        },
        "pulse-glow": {
          "0%, 100%": { boxShadow: "0 0 5px hsl(var(--primary) / 0.5)" },
          "50%": { boxShadow: "0 0 20px hsl(var(--primary) / 0.8)" },
        },
      },
      animation: {
        "slide-up": "slide-up 0.3s ease-out",
        "slide-down": "slide-down 0.3s ease-out",
        "fade-in": "fade-in 0.5s ease-out",
        "bounce-gentle": "bounce-gentle 2s ease-in-out infinite",
        "pulse-glow": "pulse-glow 2s ease-in-out infinite",
      },
    },
  },
  plugins: [tailwindcssAnimate],
} satisfies Config;
