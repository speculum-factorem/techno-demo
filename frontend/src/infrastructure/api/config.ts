// USE_MOCK: true = use mock data (no backend needed), false = use real API
// Controlled via VITE_USE_MOCK env variable (.env.development / .env.production).
// Defaults to false — real API is the expected behaviour in all environments.
export const USE_MOCK: boolean = import.meta.env.VITE_USE_MOCK === 'true'
