import apiClient from './ApiClient'
import { User, LoginDto, RegisterDto, AuthTokens } from '@domain/entities/User'

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
    const { data } = await apiClient.post<LoginChallengeResponse>('/auth/login', dto)
    return data
  },

  async verifyLoginCode(requestId: string, code: string): Promise<{ user: User; tokens: AuthTokens }> {
    const { data } = await apiClient.post<AuthResponse>('/auth/login/verify-code', {
      requestId,
      code: code.replace(/\s/g, ''),
    })
    return mapAuthResponse(data)
  },

  async resendLoginCode(requestId: string): Promise<LoginChallengeResponse> {
    const { data } = await apiClient.post<LoginChallengeResponse>('/auth/login/resend-code', { requestId })
    return data
  },

  async register(dto: RegisterDto): Promise<EmailCodeResponse> {
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
    const { data } = await apiClient.post<EmailCodeResponse>('/auth/verify-email-code/resend', { email })
    return data
  },

  async forgotPassword(email: string): Promise<{ message: string; emailConfigured?: boolean }> {
    const { data } = await apiClient.post<{ message: string; emailConfigured?: boolean }>('/auth/forgot-password', { email })
    return data
  },

  async resetPassword(token: string, newPassword: string, confirmPassword: string): Promise<{ message: string }> {
    const { data } = await apiClient.post<{ message: string }>('/auth/reset-password', { token, newPassword, confirmPassword })
    return data
  },

  async changePassword(currentPassword: string, newPassword: string, confirmPassword: string): Promise<{ message: string }> {
    const { data } = await apiClient.post<{ message: string }>('/auth/change-password', { currentPassword, newPassword, confirmPassword })
    return data
  },

  async logout(): Promise<void> {
    await apiClient.post('/auth/logout')
  },

  async refreshToken(refreshToken: string): Promise<{ user: User; tokens: AuthTokens }> {
    const { data } = await apiClient.post<AuthResponse>('/auth/refresh', { refreshToken })
    return mapAuthResponse(data)
  },

  async me(): Promise<User> {
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
