// When VITE_USE_MOCK=true (set in .env.development), use mock data.
// In Docker production the real API is used.
export const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true'
