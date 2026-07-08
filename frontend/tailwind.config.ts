import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0f9fa',
          100: '#dbf1f3',
          200: '#bae2e7',
          300: '#8bcdd6',
          400: '#5ab0bd',
          500: '#3c95a4',
          600: '#087E8B',
          700: '#2d6671',
          800: '#265660',
          900: '#224851',
          950: '#132e35',
          DEFAULT: "#087E8B",
          dark: "#06616b",
        },
        accent: {
          50: '#fef2ee',
          100: '#fde4db',
          200: '#fac9b7',
          300: '#f7a88a',
          400: '#f3865e',
          500: '#EB6534',
          600: '#c8562c',
          700: '#a44724',
          800: '#7f381c',
          900: '#5a2a17',
          DEFAULT: '#EB6534',
          hover: '#c8562c',
        },
        surface: {
          50: '#fafafa',
          100: '#f4f4f5',
          200: '#e4e4e7',
          300: '#d4d4d8',
          400: '#a1a1aa',
          500: '#71717a',
          600: '#52525b',
          700: '#3f3f46',
          800: '#27272a',
          900: '#18181b',
          950: '#09090b',
        },
        urgent: {
          DEFAULT: "#DC2626",
          light: "#fef2f2",
        },
      },
      animation: {
        'fade-in': 'fadeIn 0.4s ease-out forwards',
        'slide-up': 'slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'slide-in-right': 'slideInRight 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'scale-in': 'scaleIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(20px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
      boxShadow: {
        'card': '0 1px 3px 0 rgba(0, 0, 0, 0.04), 0 1px 2px -1px rgba(0, 0, 0, 0.04)',
        'card-hover': '0 4px 12px 0 rgba(0, 0, 0, 0.06), 0 1px 2px 0 rgba(0, 0, 0, 0.04)',
        'elevated': '0 10px 30px -10px rgba(0, 0, 0, 0.08), 0 4px 8px -4px rgba(0, 0, 0, 0.04)',
        'brand-sm': '0 0 0 3px rgba(8, 126, 139, 0.12)',
        'brand': '0 0 0 1px rgba(8, 126, 139, 0.1), 0 1px 2px 0 rgba(8, 126, 139, 0.06)',
      },
    },
  },
  plugins: [],
};

export default config;
