import apiClient from './ApiClient'
import { USE_MOCK } from './config'
import { User, LoginDto, RegisterDto, AuthTokens } from '@domain/entities/User'
import { mockUser } from './MockData'

export const authApi = {
  async login(dto: LoginDto): Promise<{ user: User; tokens: AuthTokens }> {
    if (USE_MOCK) {
      await new Promise(r => setTimeout(r, 800))
      if (dto.username === 'admin' && dto.password === 'admin') {
        return {
          user: mockUser,
          tokens: { accessToken: 'mock-token', refreshToken: 'mock-refresh', expiresIn: 3600 },
        }
      }
      throw { response: { data: { message: 'Неверный логин или пароль' } } }
    }
    const { data } = await apiClient.post<{
      accessToken: string; refreshToken: string; expiresIn: number;
      user: { id: number; username: string; email: string; fullName: string; role: string }
    }>('/auth/login', dto)
    return {
      user: {
        id: String(data.user.id),
        username: data.user.username,
        email: data.user.email,
        fullName: data.user.fullName,
        role: data.user.role as User['role'],
      },
      tokens: { accessToken: data.accessToken, refreshToken: data.refreshToken, expiresIn: data.expiresIn },
    }
  },

  async register(dto: RegisterDto): Promise<{ message: string }> {
    if (USE_MOCK) {
      await new Promise(r => setTimeout(r, 800))
      return { message: 'Registration successful. Check your email to verify your account.' }
    }
    const { data } = await apiClient.post<{ message: string }>('/auth/register', {
      ...dto,
      organizationId: dto.organizationId ? Number(dto.organizationId) : undefined,
    })
    return data
  },

  async verifyEmail(token: string): Promise<{ message: string }> {
    const { data } = await apiClient.get<{ message: string }>(`/auth/verify-email?token=${encodeURIComponent(token)}`)
    return data
  },

  async logout(): Promise<void> {
    if (USE_MOCK) return
    await apiClient.post('/auth/logout')
  },

  async refreshToken(refreshToken: string): Promise<AuthTokens> {
    const { data } = await apiClient.post<AuthTokens>('/auth/refresh', { refreshToken })
    return data
  },
}
