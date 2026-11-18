/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Times New Roman"', 'Times', 'Georgia', 'serif'],
        serif: ['"Times New Roman"', 'Times', 'Georgia', 'serif'],
      },
      colors: {
        canvas: '#FAF9F6',
        card: '#FFFFFF',
        stone: {
          border: '#E6E2DA',
          cream: '#F3EFEA',
        },
        ink: {
          primary: '#111111',
          secondary: '#52525B',
          muted: '#71717A',
        },
        accent: {
          latte: '#F3EFEA',
          mint: {
            bg: '#ECFDF5',
            text: '#166534',
            border: '#BBF7D0',
          },
          sand: {
            bg: '#FFFBEB',
            text: '#92400E',
            border: '#FDE68A',
          },
          rose: {
            bg: '#FEF2F2',
            text: '#991B1B',
            border: '#FECACA',
          },
        },
      },
    },
  },
  plugins: [],
}
