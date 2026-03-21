import apiClient from './ApiClient'
import { USE_MOCK } from './config'
import { User, LoginDto, RegisterDto, AuthTokens } from '@domain/entities/User'
import { mockUser } from './MockData'

type AuthResponse = {
  accessToken: string
  refreshToken: string
  expiresIn: number
  user: { id: number; username: string; email: string; fullName: string; role: string }
}

type LoginChallengeResponse = {
  requestId: string
  expiresInSeconds: number
  message: string
}

type EmailCodeResponse = {
  message: string
  expiresInSeconds: number
  emailConfigured?: boolean
}

const mapAuthResponse = (data: AuthResponse): { user: User; tokens: AuthTokens } => ({
  user: {
    id: String(data.user.id),
    username: data.user.username,
    email: data.user.email,
    fullName: data.user.fullName,
    role: data.user.role as User['role'],
  },
  tokens: { accessToken: data.accessToken, refreshToken: data.refreshToken, expiresIn: data.expiresIn },
})

export const authApi = {
  async login(dto: LoginDto): Promise<LoginChallengeResponse> {
    if (USE_MOCK) {
      await new Promise(r => setTimeout(r, 800))
      const isDemoAdmin = dto.username === 'admin' && dto.password === 'admin'
      const isDemoAgronomist = dto.username === 'agronomist' && dto.password === 'agronomist'
      if (isDemoAdmin || isDemoAgronomist) {
        return { requestId: 'mock-request-id', expiresInSeconds: 600, message: 'Код отправлен на email' }
      }
      throw { response: { data: { message: 'Неверный логин или пароль' } } }
    }
    const { data } = await apiClient.post<LoginChallengeResponse>('/auth/login', dto)
    return data
  },

  async verifyLoginCode(requestId: string, code: string): Promise<{ user: User; tokens: AuthTokens }> {
    if (USE_MOCK) {
      await new Promise(r => setTimeout(r, 600))
      if (code === '000000') {
        return {
          user: mockUser,
          tokens: { accessToken: 'mock-token', refreshToken: 'mock-refresh', expiresIn: 3600 },
        }
      }
      throw { response: { data: { message: 'Неверный код подтверждения' } } }
    }
    const { data } = await apiClient.post<AuthResponse>('/auth/login/verify-code', {
      requestId,
      code: code.replace(/\s/g, ''),
    })
    return mapAuthResponse(data)
  },

  async resendLoginCode(requestId: string): Promise<LoginChallengeResponse> {
    if (USE_MOCK) {
      await new Promise(r => setTimeout(r, 500))
      return { requestId: 'mock-request-id-2', expiresInSeconds: 600, message: 'Новый код отправлен на email' }
    }
    const { data } = await apiClient.post<LoginChallengeResponse>('/auth/login/resend-code', { requestId })
    return data
  },

  async register(dto: RegisterDto): Promise<EmailCodeResponse> {
    if (USE_MOCK) {
      await new Promise(r => setTimeout(r, 800))
      return { message: 'Registration successful. Check your email to verify your account.', expiresInSeconds: 86400 }
    }
    const orgRaw = dto.organizationId != null && dto.organizationId !== ''
      ? Number(dto.organizationId)
      : undefined
    const orgNum = Number.isFinite(orgRaw as number) ? orgRaw : undefined
    const body: Record<string, unknown> = {
      username: dto.username,
      email: dto.email,
      fullName: dto.fullName,
      password: dto.password,
      confirmPassword: dto.confirmPassword,
      personalDataConsent: dto.personalDataConsent,
    }
    if (dto.inviteCode != null && dto.inviteCode !== '') {
      body.inviteCode = dto.inviteCode
      if (orgNum !== undefined) body.organizationId = orgNum
    }
    const { data } = await apiClient.post<EmailCodeResponse>('/auth/register', body)
    return data
  },

  async verifyEmail(token: string): Promise<{ user: User; tokens: AuthTokens }> {
    const { data } = await apiClient.get<AuthResponse>(`/auth/verify-email?token=${encodeURIComponent(token)}`)
    return mapAuthResponse(data)
  },

  async verifyEmailWithCode(email: string, code: string): Promise<{ user: User; tokens: AuthTokens }> {
    const { data } = await apiClient.post<AuthResponse>('/auth/verify-email-code', {
      email,
      code: code.replace(/\s/g, ''),
    })
    return mapAuthResponse(data)
  },

  async resendEmailCode(email: string): Promise<EmailCodeResponse> {
    if (USE_MOCK) {
      await new Promise(r => setTimeout(r, 500))
      return { message: 'Новый код отправлен на email', expiresInSeconds: 86400 }
    }
    const { data } = await apiClient.post<EmailCodeResponse>('/auth/verify-email-code/resend', { email })
    return data
  },

  async forgotPassword(email: string): Promise<{ message: string; emailConfigured?: boolean }> {
    if (USE_MOCK) {
      await new Promise(r => setTimeout(r, 800))
      return { message: 'Если указанный email зарегистрирован, на него отправлена ссылка для сброса пароля.', emailConfigured: false }
    }
    const { data } = await apiClient.post<{ message: string; emailConfigured?: boolean }>('/auth/forgot-password', { email })
    return data
  },

  async resetPassword(token: string, newPassword: string, confirmPassword: string): Promise<{ message: string }> {
    if (USE_MOCK) {
      await new Promise(r => setTimeout(r, 800))
      return { message: 'Пароль успешно изменён. Войдите с новым паролем.' }
    }
    const { data } = await apiClient.post<{ message: string }>('/auth/reset-password', { token, newPassword, confirmPassword })
    return data
  },

  async changePassword(currentPassword: string, newPassword: string, confirmPassword: string): Promise<{ message: string }> {
    if (USE_MOCK) {
      await new Promise(r => setTimeout(r, 800))
      return { message: 'Пароль успешно изменён.' }
    }
    const { data } = await apiClient.post<{ message: string }>('/auth/change-password', { currentPassword, newPassword, confirmPassword })
    return data
  },

  async logout(): Promise<void> {
    if (USE_MOCK) return
    await apiClient.post('/auth/logout')
  },

  async refreshToken(refreshToken: string): Promise<{ user: User; tokens: AuthTokens }> {
    const { data } = await apiClient.post<AuthResponse>('/auth/refresh', { refreshToken })
    return mapAuthResponse(data)
  },

  async me(): Promise<User> {
    if (USE_MOCK) {
      await new Promise(r => setTimeout(r, 100))
      const stored = localStorage.getItem('user')
      if (stored) return JSON.parse(stored) as User
      throw new Error('Not authenticated')
    }
    const { data } = await apiClient.get<{ id: number; username: string; email: string; fullName: string; role: string }>('/auth/me')
    return {
      id: String(data.id),
      username: data.username,
      email: data.email,
      fullName: data.fullName,
      role: data.role as User['role'],
    }
  },
}
