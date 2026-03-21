// USE_MOCK: true = use mock data (no backend needed), false = use real API
// In Docker, VITE_USE_MOCK is set to 'false' via environment.
// In local dev without Docker, we default to mock mode.
export const USE_MOCK: boolean =
  import.meta.env.VITE_USE_MOCK === 'false'
    ? false
    : true // default to mock when no explicit override to 'false'
