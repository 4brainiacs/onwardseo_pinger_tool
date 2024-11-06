/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      screens: {
        'xs': '402px',
        'sm': '481px',
        'md': '769px',
        'lg': '1025px',
        'xl': '1281px',
        '2xl': '1537px',
      },
      spacing: {
        '18': '4.5rem',
        '22': '5.5rem',
      },
      minHeight: {
        '11': '2.75rem',
        '12': '3rem',
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
      },
    },
  },
  future: {
    hoverOnlyWhenSupported: true,
  },
  plugins: [],
}