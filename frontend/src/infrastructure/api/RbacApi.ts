import apiClient from './ApiClient'
import { AppRole, Permission, RbacUser, ROLE_PERMISSIONS } from '@domain/entities/RbacUser'

export type RbacUserApiDto = {
  id: string
  username: string
  fullName: string
  email: string
  appRole: string
  organizationId: string
  organizationName: string
  farmIds: string[]
  fieldIds: string[]
  lastLogin: string
  createdAt: string
  active: boolean
}

const APP_ROLES: AppRole[] = ['super_admin', 'org_admin', 'agronomist', 'operator', 'viewer']

function normalizeAppRole(r: string): AppRole {
  const x = r as AppRole
  if (APP_ROLES.includes(x)) return x
  return 'viewer'
}

export function rbacUserFromApi(d: RbacUserApiDto): RbacUser {
  const role = normalizeAppRole(d.appRole)
  const permissions: Permission[] = ROLE_PERMISSIONS[role] ?? ROLE_PERMISSIONS.viewer
  return {
    id: d.id,
    username: d.username,
    fullName: d.fullName || d.username,
    email: d.email,
    role,
    organizationId: d.organizationId || '',
    organizationName: d.organizationName || '',
    farmIds: d.farmIds ?? [],
    fieldIds: d.fieldIds ?? [],
    lastLogin: d.lastLogin || d.createdAt,
    createdAt: d.createdAt,
    active: d.active,
    permissions,
  }
}

export type InviteCodeApiDto = {
  code: string
  registerUrl: string
  organizationId: number
  defaultAppRole: string
  invitedEmail: string | null
  expiresAt: string | null
  createdAt: string | null
  usedAt: string | null
  consumableOnce: boolean
  emailSent: boolean
}

export type CreateInvitePayload = {
  email?: string
  appRole: string
  expiresInDays?: number
  /** Только для платформенного админа */
  organizationId?: number
}

export const rbacApi = {
  async listUsers(): Promise<RbacUser[]> {
    const { data } = await apiClient.get<RbacUserApiDto[]>('/auth/admin/users')
    return (data || []).map(rbacUserFromApi)
  },

  async updateRole(userId: string, appRole: AppRole): Promise<RbacUser> {
    const { data } = await apiClient.patch<RbacUserApiDto>(`/auth/admin/users/${userId}/role`, { appRole })
    return rbacUserFromApi(data)
  },

  async updateActive(userId: string, active: boolean): Promise<RbacUser> {
    const { data } = await apiClient.patch<RbacUserApiDto>(`/auth/admin/users/${userId}/active`, { active })
    return rbacUserFromApi(data)
  },

  async createInvite(payload: CreateInvitePayload): Promise<InviteCodeApiDto> {
    const { data } = await apiClient.post<InviteCodeApiDto>('/auth/admin/invites', payload)
    return data
  },

  async listInvites(organizationId?: number): Promise<InviteCodeApiDto[]> {
    const { data } = await apiClient.get<InviteCodeApiDto[]>('/auth/admin/invites', {
      params: organizationId != null ? { organizationId } : undefined,
    })
    return data || []
  },

  async revokeInvite(code: string): Promise<void> {
    await apiClient.delete(`/auth/admin/invites/${encodeURIComponent(code)}`)
  },
}
