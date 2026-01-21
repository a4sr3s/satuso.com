/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Primary - clean black
        primary: {
          DEFAULT: '#171717',
          hover: '#262626',
          light: '#F5F5F5',
        },
        // Backgrounds
        surface: '#FAFAFA',
        'surface-hover': '#F5F5F5',
        sidebar: '#FFFFFF',
        // Text
        'text-primary': '#171717',
        'text-secondary': '#525252',
        'text-muted': '#A3A3A3',
        // Borders
        border: '#E5E5E5',
        'border-light': '#F5F5F5',
        // Status - keep these colorful for meaning
        success: '#22C55E',
        error: '#EF4444',
        warning: '#F59E0B',
        info: '#3B82F6',
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
      fontSize: {
        // Custom sizes matching spec
        'metric-lg': ['28px', { lineHeight: '1.2', fontWeight: '600' }],
        'metric-label': ['12px', { lineHeight: '1.5', fontWeight: '400' }],
      },
      spacing: {
        sidebar: '240px',
      },
      maxWidth: {
        content: '1400px',
      },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,0.08)',
        'card-hover': '0 4px 6px rgba(0,0,0,0.1)',
      },
      borderRadius: {
        card: '8px',
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
};
