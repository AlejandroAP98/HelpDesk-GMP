import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bgCustom: "#f0f4ef",
        bgSiderBar: "#416165",
        cardCustom: "#fbfcff",
        accentCustom: "#EB6534",
        textCustom: "#111827",
        textCustomMuted: "#6b7280",
        borderCustom: "#e5e7eb",
        brandCustom: "#508484",
        urgent: {
          DEFAULT: "#DC2626",
          light: "#fef2f2",
        },
        blueCustom:"#007991",
        redCustom:"#fe4a49",
        violetCustom:"#824c71",
        yellowCustom:"#c8963e",
        greenCustom:"#60993e",
        grayCustom:"#7e7f83",
      },
      animation: {
        'fade-in': 'fadeIn 0.35s ease-out forwards',
        'fade-in-place': 'fadeInPlace 0.35s ease-out forwards',
        'slide-up': 'slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'slide-in-right': 'slideInRight 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'slide-out-right': 'slideOutRight 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'scale-in': 'scaleIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'shimmer': 'shimmer 1.8s ease-in-out infinite',
        'slide-down': 'slideDown 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'wifi-pulse': 'wifiPulse 2s ease-in-out infinite',
        'wifi-dot': 'wifiDot 2s ease-in-out infinite',
        'flash-complete': 'flashComplete 500ms ease-out',
        'flash-uncomplete': 'flashUncomplete 500ms ease-out',

      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(5px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeInPlace: {
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
        slideOutRight: {
          '0%': { opacity: '1', transform: 'translateX(0)' },
          '100%': { opacity: '0', transform: 'translateX(20px)' },
        },
        slideDown: {
          '0%': { opacity: '0', transform: 'translateY(-10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        wifiPulse: {
          '0%, 100%': { opacity: '0.15' },
          '50%': { opacity: '1' },
        },
        wifiDot: {
          '0%, 100%': { opacity: '0.4', transform: 'scale(0.85)' },
          '50%': { opacity: '1', transform: 'scale(1.15)' },
        },
        flashComplete: {
          '0%': { backgroundColor: 'rgba(96, 153, 62, 0.35)' },
          '100%': { backgroundColor: 'rgba(96, 153, 62, 0)' },
        },
        flashUncomplete: {
          '0%': { backgroundColor: 'rgba(80, 132, 132, 0.25)' },
          '100%': { backgroundColor: 'rgba(80, 132, 132, 0)' },
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
