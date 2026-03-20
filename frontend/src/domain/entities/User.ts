export type UserRole = 'ADMIN' | 'AGRONOMIST' | 'OBSERVER'

export interface User {
  id: string
  username: string
  email: string
  fullName: string
  role: UserRole
  organizationId?: string
}

export interface AuthTokens {
  accessToken: string
  refreshToken: string
  expiresIn: number
}

export interface LoginDto {
  username: string
  password: string
}
