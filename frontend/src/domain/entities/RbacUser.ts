export type AppRole = 'super_admin' | 'org_admin' | 'agronomist' | 'operator' | 'viewer'

export interface Permission {
  resource: string
  actions: ('read' | 'write' | 'delete' | 'export')[]
}

export interface RbacUser {
  id: string
  username: string
  fullName: string
  email: string
  role: AppRole
  organizationId: string
  organizationName: string
  farmIds: string[]
  fieldIds: string[]
  lastLogin: string
  createdAt: string
  active: boolean
  permissions: Permission[]
}

export const ROLE_LABELS: Record<AppRole, string> = {
  super_admin: 'Супер-администратор',
  org_admin: 'Администратор организации',
  agronomist: 'Агроном',
  operator: 'Механизатор',
  viewer: 'Наблюдатель',
}

export const ROLE_PERMISSIONS: Record<AppRole, Permission[]> = {
  super_admin: [
    { resource: 'Все', actions: ['read', 'write', 'delete', 'export'] },
  ],
  org_admin: [
    { resource: 'Поля', actions: ['read', 'write', 'delete', 'export'] },
    { resource: 'Пользователи', actions: ['read', 'write', 'delete'] },
    { resource: 'Отчёты', actions: ['read', 'export'] },
  ],
  agronomist: [
    { resource: 'Поля', actions: ['read', 'write'] },
    { resource: 'Прогнозы', actions: ['read', 'write'] },
    { resource: 'Полив', actions: ['read', 'write'] },
    { resource: 'Задачи', actions: ['read', 'write'] },
    { resource: 'Отчёты', actions: ['read', 'export'] },
  ],
  operator: [
    { resource: 'Поля', actions: ['read'] },
    { resource: 'Задачи', actions: ['read', 'write'] },
    { resource: 'Техника', actions: ['read', 'write'] },
  ],
  viewer: [
    { resource: 'Поля', actions: ['read'] },
    { resource: 'Отчёты', actions: ['read'] },
  ],
}
