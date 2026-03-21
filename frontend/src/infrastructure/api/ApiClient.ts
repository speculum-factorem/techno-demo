import axios, { AxiosInstance } from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL || '/api'

const apiClient: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
})

apiClient.interceptors.request.use((config) => {
  const tokens = localStorage.getItem('tokens')
  if (tokens) {
    const { accessToken } = JSON.parse(tokens)
    config.headers.Authorization = `Bearer ${accessToken}`
  }
  return config
})

let refreshInFlight: Promise<string | null> | null = null

const getNewAccessToken = async (): Promise<string | null> => {
  const raw = localStorage.getItem('tokens')
  if (!raw) return null

  let parsed: { refreshToken?: string } | null = null
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }

  if (!parsed?.refreshToken) return null

  const { data } = await axios.post<{
    accessToken: string
    refreshToken: string
    expiresIn: number
    user: { id: number; username: string; email: string; fullName: string; role: string }
  }>(`${BASE_URL}/auth/refresh`, { refreshToken: parsed.refreshToken })

  const nextTokens = {
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    expiresIn: data.expiresIn,
  }
  const nextUser = {
    id: String(data.user.id),
    username: data.user.username,
    email: data.user.email,
    fullName: data.user.fullName,
    role: data.user.role,
  }
  localStorage.setItem('tokens', JSON.stringify(nextTokens))
  localStorage.setItem('user', JSON.stringify(nextUser))
  return data.accessToken
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error.response?.status
    const originalRequest: any = error.config
    const requestUrl = String(originalRequest?.url || '')

    const isAuthEndpoint = requestUrl.includes('/auth/login')
      || requestUrl.includes('/auth/register')
      || requestUrl.includes('/auth/verify-email')
      || requestUrl.includes('/auth/refresh')

    if (status === 401 && !isAuthEndpoint && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true
      try {
        refreshInFlight ||= getNewAccessToken().finally(() => { refreshInFlight = null })
        const nextAccess = await refreshInFlight
        if (nextAccess) {
          originalRequest.headers = originalRequest.headers || {}
          originalRequest.headers.Authorization = `Bearer ${nextAccess}`
          return apiClient(originalRequest)
        }
      } catch (refreshError) {
        console.warn('Token refresh failed, redirecting to login:', refreshError)
      }
    }

    const authFlowPath =
      requestUrl.includes('/auth/login')
      || requestUrl.includes('/auth/register')
      || requestUrl.includes('/auth/forgot-password')
      || requestUrl.includes('/auth/reset-password')
      || requestUrl.includes('/auth/verify-email')
      || requestUrl.includes('/auth/verify-email-code')

    if (status === 401 && !authFlowPath) {
      localStorage.removeItem('tokens')
      localStorage.removeItem('user')
      window.location.href = '/auth/login'
    }
    return Promise.reject(error)
  }
)

export default apiClient
