module.exports = {
            content: ['./templates/**/*.html', './static/js/**/*.js'],
            theme: {
                extend: {
                    fontFamily: {
                        sans: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', 'sans-serif'],
                    },
                    colors: {
                        pink: {
                            50: 'rgb(var(--m3-primary-50) / <alpha-value>)',
                            100: 'rgb(var(--m3-primary-100) / <alpha-value>)',
                            200: 'rgb(var(--m3-primary-200) / <alpha-value>)',
                            300: 'rgb(var(--m3-primary-300) / <alpha-value>)',
                            400: 'rgb(var(--m3-primary-400) / <alpha-value>)',
                            500: 'rgb(var(--m3-primary-500) / <alpha-value>)',
                            600: 'rgb(var(--m3-primary-600) / <alpha-value>)',
                            700: 'rgb(var(--m3-primary-700) / <alpha-value>)',
                            800: 'rgb(var(--m3-primary-800) / <alpha-value>)',
                            900: 'rgb(var(--m3-primary-900) / <alpha-value>)',
                        },
                        rose: {
                            50: 'rgb(var(--m3-secondary-50) / <alpha-value>)',
                            100: 'rgb(var(--m3-secondary-100) / <alpha-value>)',
                            200: 'rgb(var(--m3-secondary-200) / <alpha-value>)',
                            300: 'rgb(var(--m3-secondary-300) / <alpha-value>)',
                            400: 'rgb(var(--m3-secondary-400) / <alpha-value>)',
                            500: 'rgb(var(--m3-secondary-500) / <alpha-value>)',
                            600: 'rgb(var(--m3-secondary-600) / <alpha-value>)',
                            700: 'rgb(var(--m3-secondary-700) / <alpha-value>)',
                            800: 'rgb(var(--m3-secondary-800) / <alpha-value>)',
                            900: 'rgb(var(--m3-secondary-900) / <alpha-value>)',
                        }
                    }
                }
            }
        };
