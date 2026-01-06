/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    darkMode: 'class',
    theme: {
        extend: {
            colors: {
                mint: {
                    50: '#F5FCF6',
                    100: '#E8F5E9', // Light mint
                    200: '#C8E6C9',
                    900: '#1B5E20',
                },
                lavender: {
                    100: '#E6E6FA', // Light lavender
                    200: '#D8BFD8', // Darker lavender for gradient
                    900: '#4A148C',
                },
                seafoam: '#80CBC4',
            },
            animation: {
                'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                'float': 'float 6s ease-in-out infinite',
                'shimmer': 'shimmer 2s infinite linear',
            },
            keyframes: {
                float: {
                    '0%, 100%': { transform: 'translateY(0)' },
                    '50%': { transform: 'translateY(-10px)' },
                },
                shimmer: {
                    '0%': { transform: 'translateX(-100%)' },
                    '100%': { transform: 'translateX(100%)' }
                }
            }
        },
    },
    plugins: [],
}
