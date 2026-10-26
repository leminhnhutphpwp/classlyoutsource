import type { Config } from "tailwindcss";
import { colors } from "./src/config/colors";

const config: Config = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  darkMode: ["class"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-inter)', 'Satoshi', 'sans-serif'], // TailAdmin uses Satoshi
      },
      screens: {
        "2xsm": "375px",
        xsm: "425px",
        "3xl": "2000px",
      },
      // Override Border Radius global to match TailAdmin style
      borderRadius: {
        'lg': '0.375rem',  // 6px (was 8px)
        'xl': '0.5rem',    // 8px (was 12px)
        '2xl': '0.625rem', // 10px (was 16px) - Admin standard
        '3xl': '0.75rem',  // 12px (was 24px)
        'full': '9999px',
      },
      colors: {
        current: "currentColor",
        transparent: "transparent",
        white: colors.white,
        // Primary colors - Sử dụng CSS Variables để hỗ trợ Dynamic Theme
        primary: {
          DEFAULT: "var(--color-primary)",
          light: "var(--color-primary-light)",
          dark: "var(--color-primary-dark)",
          pastel: "var(--color-primary-pastel)",
          // Thêm các shade để tương thích với code cũ
          50: "var(--color-primary-pastel)",
          // Dùng các biến CSS để màu nhạt theo theme thay vì cố định đỏ
          100: "var(--color-primary-pastel)",
          200: "var(--color-primary-light)",
          300: "var(--color-primary-light)",
          400: "var(--color-primary-light)",
          500: "var(--color-primary)",
          600: "var(--color-primary-dark)",
          700: "#B91C1C",
          800: "#991B1B",
          900: "#7F1D1D",
        },
        // Secondary colors - Academic green (theo theme qua CSS variable)
        secondary: {
          DEFAULT: "var(--color-secondary)",
          50: "#ECFDF5",
          100: "#D1FAE5",
          200: "#A7F3D0",
          300: "#6EE7B7",
          400: "#34D399",
          500: "var(--color-secondary)",
          600: "#047857",
          700: "#065F46",
          800: "#064E3B",
          900: "#064E3B",
        },
        // Accent colors - Warm orange for highlights (theo theme)
        accent: {
          DEFAULT: "var(--color-accent)",
          50: "#FFFBEB",
          100: "#FEF3C7",
          200: "#FDE68A",
          300: "#FCD34D",
          400: "#FBBF24",
          500: "var(--color-accent)",
          600: "#D97706",
          700: "#B45309",
          800: "#92400E",
          900: "#78350F",
        },
        // Success colors - Educational achievement green (theo theme)
        success: {
          DEFAULT: "var(--color-success)",
          50: "#ECFDF5",
          100: "#D1FAE5",
          200: "#A7F3D0",
          300: "#6EE7B7",
          400: "#34D399",
          500: "var(--color-success)",
          600: "#059669",
          700: "#047857",
          800: "#065F46",
          900: "#064E3B",
        },
        // Warning colors - Attention yellow (theo theme)
        warning: {
          DEFAULT: "var(--color-warning)",
          50: "#FFFBEB",
          100: "#FEF3C7",
          200: "#FDE68A",
          300: "#FCD34D",
          400: "#FBBF24",
          500: "var(--color-warning)",
          600: "#D97706",
          700: "#B45309",
          800: "#92400E",
          900: "#78350F",
        },
        // Error colors - Sử dụng màu từ config (trùng với primary)
        error: {
          DEFAULT: colors.error.DEFAULT, // #EF4444
          light: colors.error.light,     // #F87171
          pastel: colors.error.pastel,    // #FFE4E6
          dark: colors.error.dark,        // #DC2626
          // Thêm các shade để tương thích
          50: colors.error.pastel,
          100: "#FEE2E2",
          200: "#FECACA",
          300: "#FCA5A5",
          400: colors.error.light,
          500: colors.error.DEFAULT,
          600: colors.error.dark,
          700: "#B91C1C",
          800: "#991B1B",
          900: "#7F1D1D",
        },
        // Info colors - Information blue (theo theme)
        info: {
          DEFAULT: "var(--color-info)",
          50: "#EFF6FF",
          100: "#DBEAFE",
          200: "#BFDBFE",
          300: "#93C5FD",
          400: "#60A5FA",
          500: "var(--color-info)",
          600: "#2563EB",
          700: "#1D4ED8",
          800: "#1E40AF",
          900: "#1E3A8A",
        },
        // Neutral colors - Professional grays (sử dụng màu dark từ config + theme)
        neutral: {
          DEFAULT: "var(--color-neutral)",
          50: "#F9FAFB",
          100: "#F3F4F6",
          200: "#E5E7EB",
          300: "#D1D5DB",
          400: "#9CA3AF",
          500: "#6B7280",
          600: "#4B5563",
          700: colors.dark.light,  // #374151
          800: colors.dark.DEFAULT, // #1F2937 - Màu tối từ config
          900: "#111827",
        },
        // Legacy colors for compatibility (sử dụng màu từ config)
        stroke: "#E5E7EB",
        "stroke-dark": colors.dark.light, // #374151
        dark: {
          DEFAULT: "#111827",
          2: colors.dark.DEFAULT,  // #1F2937 - Màu tối từ config
          3: colors.dark.light,    // #374151
          4: "#4B5563",
          5: "#6B7280",
          6: "#9CA3AF",
          7: "#D1D5DB",
          8: "#E5E7EB",
        },
        gray: {
          DEFAULT: "#F3F4F6",
          dark: "#111827",
          1: "#F9FAFB",
          2: "#F3F4F6",
          3: "#E5E7EB",
          4: "#D1D5DB",
          5: "#9CA3AF",
          6: "#6B7280",
          7: "#374151",
        },
        green: {
          DEFAULT: "#10B981",
          dark: "#047857",
          light: {
            DEFAULT: "#34D399",
            1: "#10B981",
            2: "#6EE7B7",
            3: "#A7F3D0",
            4: "#D1FAE5",
            5: "#ECFDF5",
            6: "#F0FDF4",
            7: "#F7FEFC",
          },
        },
        red: {
          DEFAULT: colors.primary.DEFAULT, // #EF4444
          dark: colors.primary.dark,        // #DC2626
          light: {
            DEFAULT: colors.primary.light,  // #F87171
            2: "#FCA5A5",
            3: "#FECACA",
            4: "#FEE2E2",
            5: "#FEF2F2",
            6: colors.primary.pastel,      // #FFE4E6
          },
        },
        blue: {
          DEFAULT: "#2563EB",
          dark: "#1D4ED8",
          light: {
            DEFAULT: "#3B82F6",
            2: "#60A5FA",
            3: "#93C5FD",
            4: "#BFDBFE",
            5: "#DBEAFE",
          },
        },
        orange: {
          light: {
            DEFAULT: "#FBBF24",
          },
        },
        yellow: {
          dark: {
            DEFAULT: "#F59E0B",
            2: "#D97706",
          },
          light: {
            DEFAULT: "#FCD34D",
            4: "#FFFBEB",
          },
        },
      },
      // TailAdmin Font Sizes
      fontSize: {
        'xs': ['0.75rem', { lineHeight: '1.5' }],
        'sm': ['0.875rem', { lineHeight: '1.5' }],
        'base': ['1rem', { lineHeight: '1.5' }],
        'lg': ['1.125rem', { lineHeight: '1.5' }],
        'xl': ['1.25rem', { lineHeight: '1.5' }],
        '2xl': ['1.5rem', { lineHeight: '1.5' }],
        '3xl': ['1.875rem', { lineHeight: '1.5' }],
        '4xl': ['2.25rem', { lineHeight: '1.5' }],
        '5xl': ['3rem', { lineHeight: '1' }],

        // Custom headers from existing config (retained)
        "heading-1": ["60px", "72px"],
        "heading-2": ["48px", "58px"],
        "heading-3": ["40px", "48px"],
        "heading-4": ["35px", "45px"],
        "heading-5": ["28px", "40px"],
        "heading-6": ["24px", "30px"],
        "body-2xlg": ["22px", "28px"],
        "body-sm": ["14px", "22px"],
        "body-xs": ["12px", "20px"],
      },
      // TailAdmin Spacing Override
      spacing: {
        4.5: "1.125rem",
        5.5: "1.375rem",
        6.5: "1.625rem",
        7.5: "1.875rem", // Signature TailAdmin spacing
        8.5: "2.125rem",
        9.5: "2.375rem",
        10.5: "2.625rem",
        11.5: "2.875rem",
        12.5: "3.125rem",
        13.5: "3.375rem",
        14.5: "3.625rem",
        15.5: "3.875rem",
        16.5: "4.125rem",
        17.5: "4.375rem",
        18.5: "4.625rem",
        19.5: "4.875rem",
        21.5: "5.375rem",
        22.5: "5.625rem",
        25.5: "6.375rem",
        27.5: "6.875rem",
        29.5: "7.375rem",
        32.5: "8.125rem",
        34.5: "8.625rem",
        37.5: "9.375rem",
        39.5: "9.875rem",
        42.5: "10.625rem",
        46.5: "11.625rem",
        47.5: "11.875rem",
        52.5: "13.125rem",
        54.5: "13.625rem",
        55.5: "13.875rem",
        62.5: "15.625rem",
        67.5: "16.875rem",
        72.5: "18.125rem",
        132.5: "33.125rem",
        171.5: "42.875rem",
        187.5: "46.875rem",
        242.5: "60.625rem",
      },
      maxWidth: {
        2.5: "0.625rem",
        3: "0.75rem",
        4: "1rem",
        7: "1.75rem",
        9: "2.25rem",
        10: "2.5rem",
        10.5: "2.625rem",
        11: "2.75rem",
        13: "3.25rem",
        14: "3.5rem",
        15: "3.75rem",
        16: "4rem",
        22.5: "5.625rem",
        25: "6.25rem",
        30: "7.5rem",
        34: "8.5rem",
        35: "8.75rem",
        40: "10rem",
        42.5: "10.625rem",
        44: "11rem",
        45: "11.25rem",
        46.5: "11.625rem",
        60: "15rem",
        70: "17.5rem",
        90: "22.5rem",
        94: "23.5rem",
        100: "25rem",
        103: "25.75rem",
        125: "31.25rem",
        132.5: "33.125rem",
        142.5: "35.625rem",
        150: "37.5rem",
        180: "45rem",
        203: "50.75rem",
        230: "57.5rem",
        242.5: "60.625rem",
        270: "67.5rem",
        280: "70rem",
        292.5: "73.125rem",
      },
      maxHeight: {
        35: "8.75rem",
        70: "17.5rem",
        90: "22.5rem",
        550: "34.375rem",
        300: "18.75rem",
      },
      minWidth: {
        22.5: "5.625rem",
        42.5: "10.625rem",
        47.5: "11.875rem",
        75: "18.75rem",
      },
      zIndex: {
        999999: "999999",
        99999: "99999",
        9999: "9999",
        999: "999",
        99: "99",
        9: "9",
        1: "1",
      },
      opacity: {
        65: ".65",
      },
      aspectRatio: {
        "4/3": "4 / 3",
        "21/9": "21 / 9",
      },
      backgroundImage: {
        video: "url('../images/video/video.png')",
      },
      content: {
        "icon-copy": 'url("../images/icon/icon-copy-alt.svg")',
      },
      transitionProperty: { width: "width", stroke: "stroke" },
      borderWidth: {
        6: "6px",
        10: "10px",
        12: "12px",
      },
      boxShadow: {
        // Override DEFAULT Tailwind shadows to match TailAdmin style
        sm: "0px 1px 2px 0px rgba(0, 0, 0, 0.12)",
        DEFAULT: "0px 1px 3px 0px rgba(0, 0, 0, 0.12)",
        md: "0px 4px 7px 0px rgba(0, 0, 0, 0.14)", // TailAdmin 'default'
        lg: "0px 8px 13px -3px rgba(0, 0, 0, 0.07)", // TailAdmin 'card-2' (Signature soft shadow)
        xl: "0px 10px 30px 0px rgba(0, 0, 0, 0.1)",
        "2xl": "0px 13px 40px 0px rgba(13, 10, 44, 0.1)",

        // Custom TailAdmin shadows (kept from existing config)
        default: "0px 4px 7px 0px rgba(0, 0, 0, 0.14)",
        error: "0px 12px 34px 0px rgba(13, 10, 44, 0.05)",
        card: "0px 1px 2px 0px rgba(0, 0, 0, 0.12)",
        "card-2": "0px 8px 13px -3px rgba(0, 0, 0, 0.07)",
        "card-3": "0px 2px 3px 0px rgba(183, 183, 183, 0.50)",
        "card-4": "0px 1px 3px 0px rgba(0, 0, 0, 0.12)",
        "card-5": "0px 1px 3px 0px rgba(0, 0, 0, 0.13)",
        "card-6": "0px 3px 8px 0px rgba(0, 0, 0, 0.08)",
        "card-7": "0px 0.5px 3px 0px rgba(0, 0, 0, 0.18)",
        "card-8": "0px 1px 2px 0px rgba(0, 0, 0, 0.10)",
        "card-9": "0px 1px 3px 0px rgba(0, 0, 0, 0.08)",
        "card-10": "0px 2px 3px 0px rgba(0, 0, 0, 0.10)",
        switcher:
          "0px 2px 4px rgba(0, 0, 0, 0.2), inset 0px 2px 2px #FFFFFF, inset 0px -1px 1px rgba(0, 0, 0, 0.1)",
        "switch-1": "0px 0px 4px 0px rgba(0, 0, 0, 0.10)",
        "switch-2": "0px 0px 5px 0px rgba(0, 0, 0, 0.15)",
        datepicker: "-5px 0 0 #1f2a37, 5px 0 0 #1f2a37",
        1: "0px 1px 2px 0px rgba(84, 87, 118, 0.12)",
        2: "0px 2px 3px 0px rgba(84, 87, 118, 0.15)",
        3: "0px 8px 8.466px 0px rgba(113, 116, 152, 0.05), 0px 8px 16.224px 0px rgba(113, 116, 152, 0.07), 0px 18px 31px 0px rgba(113, 116, 152, 0.10)",
        4: "0px 13px 40px 0px rgba(13, 10, 44, 0.22), 0px -8px 18px 0px rgba(13, 10, 44, 0.04)",
        5: "0px 10px 30px 0px rgba(85, 106, 235, 0.12), 0px 4px 10px 0px rgba(85, 106, 235, 0.04), 0px -18px 38px 0px rgba(85, 106, 235, 0.04)",
        6: "0px 12px 34px 0px rgba(13, 10, 44, 0.08), 0px 34px 26px 0px rgba(13, 10, 44, 0.05)",
        7: "0px 18px 25px 0px rgba(113, 116, 152, 0.05)",
      },
      dropShadow: {
        card: "0px 8px 13px rgba(0, 0, 0, 0.07)",
        1: "0px 1px 0px #E2E8F0",
        2: "0px 1px 4px rgba(0, 0, 0, 0.12)",
        3: "0px 0px 4px rgba(0, 0, 0, 0.15)",
        4: "0px 0px 2px rgba(0, 0, 0, 0.2)",
        5: "0px 1px 5px rgba(0, 0, 0, 0.2)",
      },
      keyframes: {
        linspin: {
          "100%": { transform: "rotate(360deg)" },
        },
        easespin: {
          "12.5%": { transform: "rotate(135deg)" },
          "25%": { transform: "rotate(270deg)" },
          "37.5%": { transform: "rotate(405deg)" },
          "50%": { transform: "rotate(540deg)" },
          "62.5%": { transform: "rotate(675deg)" },
          "75%": { transform: "rotate(810deg)" },
          "87.5%": { transform: "rotate(945deg)" },
          "100%": { transform: "rotate(1080deg)" },
        },
        "left-spin": {
          "0%": { transform: "rotate(130deg)" },
          "50%": { transform: "rotate(-5deg)" },
          "100%": { transform: "rotate(130deg)" },
        },
        "right-spin": {
          "0%": { transform: "rotate(-130deg)" },
          "50%": { transform: "rotate(5deg)" },
          "100%": { transform: "rotate(-130deg)" },
        },
        rotating: {
          "0%, 100%": { transform: "rotate(360deg)" },
          "50%": { transform: "rotate(0deg)" },
        },
        topbottom: {
          "0%, 100%": { transform: "translate3d(0, -100%, 0)" },
          "50%": { transform: "translate3d(0, 0, 0)" },
        },
        bottomtop: {
          "0%, 100%": { transform: "translate3d(0, 0, 0)" },
          "50%": { transform: "translate3d(0, -100%, 0)" },
        },
        line: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(100%)" },
        },
        "line-revert": {
          "0%, 100%": { transform: "translateY(100%)" },
          "50%": { transform: "translateY(0)" },
        },
      },
      animation: {
        linspin: "linspin 1568.2353ms linear infinite",
        easespin: "easespin 5332ms cubic-bezier(0.4, 0, 0.2, 1) infinite both",
        "left-spin":
          "left-spin 1333ms cubic-bezier(0.4, 0, 0.2, 1) infinite both",
        "right-spin":
          "right-spin 1333ms cubic-bezier(0.4, 0, 0.2, 1) infinite both",
        "ping-once": "ping 5s cubic-bezier(0, 0, 0.2, 1)",
        rotating: "rotating 30s linear infinite",
        topbottom: "topbottom 60s infinite alternate linear",
        bottomtop: "bottomtop 60s infinite alternate linear",
        "spin-1.5": "spin 1.5s linear infinite",
        "spin-2": "spin 2s linear infinite",
        "spin-3": "spin 3s linear infinite",
        line1: "line 10s infinite linear",
        line2: "line-revert 8s infinite linear",
        line3: "line 7s infinite linear",
      },
    },
  },
  plugins: [
    function ({ addBase, theme }: any) {
      addBase({
        // Global Form Styles - TailAdmin Signature
        'input[type="text"], input[type="email"], input[type="password"], input[type="number"], textarea, select': {
          width: '100%',
          padding: '0.75rem 1.25rem', // py-3 px-5
          borderRadius: theme('borderRadius.DEFAULT'), // rounded
          backgroundColor: 'transparent',
          borderWidth: '1.5px', // border-[1.5px]
          borderColor: theme('colors.gray.200'), // Default stroke
          outline: 'none',
          transitionProperty: 'all',
          transitionDuration: '300ms',
          '&:focus': {
            borderColor: theme('colors.primary.DEFAULT'), // focus:border-primary
          },
          '&:disabled': {
            cursor: 'default',
            backgroundColor: theme('colors.gray.100'),
          },
        },
        'textarea': {
          minHeight: '120px',
        },
        // Dark mode styles for forms
        '.dark input[type="text"], .dark input[type="email"], .dark input[type="password"], .dark input[type="number"], .dark textarea, .dark select': {
          borderColor: theme('colors.gray.700'),
          backgroundColor: theme('colors.gray.900'),
          '&:focus': {
            borderColor: theme('colors.primary.DEFAULT'),
          },
          '&:disabled': {
            backgroundColor: theme('colors.gray.800'),
          }
        },
        // Table Styles (TailAdmin has clean tables)
        'table': {
          width: '100%',
          borderCollapse: 'collapse',
        },
        'th': {
          padding: '1rem 1.25rem', // py-4 px-4
          textAlign: 'left',
          fontWeight: '500',
        },
        'td': {
          padding: '1rem 1.25rem',
        }
      });
    }
  ],
};
export default config;
