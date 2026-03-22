import React, { useCallback, useEffect, useState } from 'react'
import { useSelector } from 'react-redux'
import styles from './RbacManagementPage.module.scss'
import { RbacUser, AppRole, ROLE_LABELS, ROLE_PERMISSIONS } from '@domain/entities/RbacUser'
import { rbacApi, type InviteCodeApiDto } from '@infrastructure/api/RbacApi'
import type { RootState } from '@application/store'

function apiErrorMessage(err: unknown, fallback: string): string {
  const e = err as { response?: { data?: Record<string, unknown>; status?: number } }
  const d = e.response?.data
  if (!d || typeof d !== 'object') return fallback
  const msg = d.message
  if (typeof msg === 'string' && msg.trim()) return msg
  const detail = d.detail
  if (typeof detail === 'string' && detail.trim()) return detail
  const er = d.error
  if (typeof er === 'string' && er.trim()) return er
  return fallback
}

function initials(fullName: string, username: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2 && parts[0][0] && parts[1][0]) {
    return (parts[0][0] + parts[1][0]).toUpperCase()
  }
  if (parts.length === 1 && parts[0].length >= 1) {
    return parts[0].slice(0, 2).toUpperCase()
  }
  return username.slice(0, 2).toUpperCase() || '?'
}

function formatDateTime(iso: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

const ALL_APP_ROLES: AppRole[] = ['super_admin', 'org_admin', 'agronomist', 'operator', 'viewer']

const ROLE_COLORS: Record<AppRole, string> = {
  super_admin: '#9c27b0', org_admin: '#1a73e8', agronomist: '#34a853', operator: '#f9ab00', viewer: '#9aa0a6',
}

const RbacManagementPage: React.FC = () => {
  const authUser = useSelector((s: RootState) => s.auth.user)
  const [users, setUsers] = useState<RbacUser[]>([])
  const [selectedUser, setSelectedUser] = useState<RbacUser | null>(null)
  const [editingRole, setEditingRole] = useState(false)
  const [draftRole, setDraftRole] = useState<AppRole>('viewer')
  const [savingRole, setSavingRole] = useState(false)
  const [activeTab, setActiveTab] = useState<'users' | 'roles' | 'matrix'>('users')
  const [showInvite, setShowInvite] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteAppRole, setInviteAppRole] = useState<AppRole>('viewer')
  const [inviteExpiresDays, setInviteExpiresDays] = useState(14)
  const [inviteOrgId, setInviteOrgId] = useState('')
  const [inviteSubmitting, setInviteSubmitting] = useState(false)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [inviteSuccess, setInviteSuccess] = useState<InviteCodeApiDto | null>(null)
  const [pendingInvites, setPendingInvites] = useState<InviteCodeApiDto[]>([])
  const [invitesLoading, setInvitesLoading] = useState(false)
  const [filterRole, setFilterRole] = useState<AppRole | 'all'>('all')
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const isPlatformAdmin = authUser?.role === 'ADMIN' && !authUser.organizationId
  const canUseRbacApi = authUser?.role === 'ADMIN'

  const assignableRoles: AppRole[] = isPlatformAdmin
    ? ALL_APP_ROLES
    : ['org_admin', 'agronomist', 'operator', 'viewer']

  const loadUsers = useCallback(async () => {
    if (!canUseRbacApi) return
    setLoading(true)
    setLoadError(null)
    try {
      const list = await rbacApi.listUsers()
      setUsers(list)
    } catch (err) {
      setLoadError(apiErrorMessage(err, 'Не удалось загрузить пользователей'))
      setUsers([])
    } finally {
      setLoading(false)
    }
  }, [canUseRbacApi])

  useEffect(() => {
    if (!authUser) {
      setLoadError('Войдите в систему.')
      setUsers([])
      return
    }
    if (authUser.role !== 'ADMIN') {
      setLoadError('Экран доступен только администраторам.')
      setUsers([])
      return
    }
    void loadUsers()
  }, [authUser, loadUsers])

  useEffect(() => {
    if (!showInvite || !canUseRbacApi) return
    let cancelled = false
    ;(async () => {
      setInvitesLoading(true)
      try {
        const list = await rbacApi.listInvites()
        if (!cancelled) setPendingInvites(list)
      } catch {
        if (!cancelled) setPendingInvites([])
      } finally {
        if (!cancelled) setInvitesLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [showInvite, canUseRbacApi])

  const openInviteModal = () => {
    setInviteSuccess(null)
    setInviteError(null)
    setInviteEmail('')
    setInviteAppRole('viewer')
    setInviteExpiresDays(14)
    setInviteOrgId(authUser?.organizationId ? String(authUser.organizationId) : '')
    setShowInvite(true)
  }

  const submitInvite = async () => {
    setInviteError(null)
    if (isPlatformAdmin) {
      const oid = parseInt(inviteOrgId.trim(), 10)
      if (Number.isNaN(oid) || oid < 1) {
        setInviteError('Укажите числовой ID организации')
        return
      }
    }
    setInviteSubmitting(true)
    try {
      const res = await rbacApi.createInvite({
        appRole: inviteAppRole,
        expiresInDays: inviteExpiresDays,
        ...(inviteEmail.trim() ? { email: inviteEmail.trim() } : {}),
        ...(isPlatformAdmin ? { organizationId: parseInt(inviteOrgId.trim(), 10) } : {}),
      })
      setInviteSuccess(res)
      setPendingInvites(await rbacApi.listInvites())
    } catch (e) {
      setInviteError(apiErrorMessage(e, 'Не удалось создать приглашение'))
    } finally {
      setInviteSubmitting(false)
    }
  }

  const revokeInviteCode = async (code: string) => {
    setInviteError(null)
    try {
      await rbacApi.revokeInvite(code)
      setPendingInvites(await rbacApi.listInvites())
      if (inviteSuccess?.code === code) setInviteSuccess(null)
    } catch (e) {
      setInviteError(apiErrorMessage(e, 'Не удалось отозвать приглашение'))
    }
  }

  const toggleActive = async (id: string) => {
    const u = users.find(x => x.id === id)
    if (!u) return
    setActionError(null)
    try {
      const updated = await rbacApi.updateActive(id, !u.active)
      setUsers(prev => prev.map(x => x.id === id ? updated : x))
      setSelectedUser(s => (s?.id === id ? updated : s))
    } catch (err) {
      setActionError(apiErrorMessage(err, 'Не удалось изменить статус'))
    }
  }

  const openRoleEdit = () => {
    if (!selectedUser) return
    setDraftRole(selectedUser.role)
    setEditingRole(true)
    setActionError(null)
  }

  const saveRole = async () => {
    if (!selectedUser) return
    setSavingRole(true)
    setActionError(null)
    try {
      const updated = await rbacApi.updateRole(selectedUser.id, draftRole)
      setUsers(prev => prev.map(x => x.id === selectedUser.id ? updated : x))
      setSelectedUser(updated)
      setEditingRole(false)
    } catch (err) {
      setActionError(apiErrorMessage(err, 'Не удалось сохранить роль'))
    } finally {
      setSavingRole(false)
    }
  }

  const filtered = users.filter(u => filterRole === 'all' || u.role === filterRole)

  const stats = {
    total: users.length,
    active: users.filter(u => u.active).length,
    byRole: (Object.keys(ROLE_LABELS) as AppRole[]).map(r => ({ role: r, count: users.filter(u => u.role === r).length })),
  }

  const RESOURCES = ['Поля', 'Прогнозы', 'Полив', 'Задачи', 'Техника', 'Отчёты', 'Пользователи', 'Настройки', 'Аудит']
  const ROLES_ORDER: AppRole[] = ['super_admin', 'org_admin', 'agronomist', 'operator', 'viewer']
  const hasPermission = (role: AppRole, resource: string, action: string): boolean => {
    const perms = ROLE_PERMISSIONS[role]
    return perms.some(p => (p.resource === 'Все' || p.resource === resource) && p.actions.includes(action as 'read' | 'write' | 'delete' | 'export'))
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}><span className="material-icons-round">manage_accounts</span> Роли и права доступа</h1>
          <p className={styles.sub}>RBAC: управление пользователями, ролями и разграничением доступа</p>
        </div>
        <button type="button" className={styles.addBtn} onClick={openInviteModal}>
          <span className="material-icons-round">person_add</span> Пригласить
        </button>
      </div>

      {loadError && (
        <div className={styles.infoMsg} style={{ marginBottom: 16, borderColor: '#ea4335', background: '#fce8e6' }}>
          <span className="material-icons-round" style={{ color: '#ea4335' }}>error_outline</span> {loadError}
        </div>
      )}
      {actionError && (
        <div className={styles.infoMsg} style={{ marginBottom: 16, borderColor: '#ea4335', background: '#fce8e6' }}>
          <span className="material-icons-round" style={{ color: '#ea4335' }}>error_outline</span> {actionError}
        </div>
      )}

      {/* Stats */}
      <div className={styles.statsRow}>
        <div className={styles.statCard}><span className="material-icons-round" style={{ color: '#1a73e8' }}>people</span><strong>{stats.total}</strong><span>Пользователей</span></div>
        <div className={styles.statCard}><span className="material-icons-round" style={{ color: '#34a853' }}>how_to_reg</span><strong>{stats.active}</strong><span>Активных</span></div>
        <div className={styles.statCard}><span className="material-icons-round" style={{ color: '#ea4335' }}>person_off</span><strong>{stats.total - stats.active}</strong><span>Неактивных</span></div>
        {stats.byRole.filter(r => r.count > 0).map(r => (
          <div key={r.role} className={styles.statCard}>
            <span className="material-icons-round" style={{ color: ROLE_COLORS[r.role] }}>badge</span>
            <strong style={{ color: ROLE_COLORS[r.role] }}>{r.count}</strong>
            <span>{ROLE_LABELS[r.role].split(' ')[0]}</span>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        {(['users', 'roles', 'matrix'] as const).map(tab => (
          <button key={tab} className={`${styles.tab} ${activeTab === tab ? styles.activeTab : ''}`} onClick={() => setActiveTab(tab)}>
            <span className="material-icons-round">{tab === 'users' ? 'people' : tab === 'roles' ? 'admin_panel_settings' : 'grid_on'}</span>
            {tab === 'users' ? 'Пользователи' : tab === 'roles' ? 'Роли' : 'Матрица доступа'}
          </button>
        ))}
      </div>

      {activeTab === 'users' && (
        <>
          <div className={styles.filters}>
            <button className={`${styles.chip} ${filterRole === 'all' ? styles.activeChip : ''}`} onClick={() => setFilterRole('all')}>Все</button>
            {ROLES_ORDER.map(r => (
              <button key={r} className={`${styles.chip} ${filterRole === r ? styles.activeChip : ''}`}
                onClick={() => setFilterRole(r)}
                style={filterRole === r ? { background: ROLE_COLORS[r] + '22', color: ROLE_COLORS[r], borderColor: ROLE_COLORS[r] } : {}}>
                {ROLE_LABELS[r]}
              </button>
            ))}
          </div>
          {loading && <p className={styles.sub}>Загрузка…</p>}
          <div className={styles.userTable}>
            <div className={styles.tableHeader}>
              <span>Пользователь</span><span>Роль</span><span>Организация</span><span>Последний вход</span><span>Статус</span><span></span>
            </div>
            {!loading && filtered.map(u => (
              <div key={u.id} className={`${styles.tableRow} ${!u.active ? styles.rowInactive : ''}`} onClick={() => { setSelectedUser(u); setEditingRole(false); setActionError(null) }}>
                <div className={styles.userCell}>
                  <div className={styles.avatar} style={{ background: ROLE_COLORS[u.role] + '33', color: ROLE_COLORS[u.role] }}>
                    {initials(u.fullName, u.username)}
                  </div>
                  <div>
                    <div className={styles.userName}>{u.fullName}</div>
                    <div className={styles.userEmail}>{u.email}</div>
                  </div>
                </div>
                <span className={styles.roleBadge} style={{ background: ROLE_COLORS[u.role] + '22', color: ROLE_COLORS[u.role] }}>
                  {ROLE_LABELS[u.role]}
                </span>
                <span className={styles.orgCell}>{u.organizationName}</span>
                <span className={styles.loginCell}>{formatDateTime(u.lastLogin)}</span>
                <span className={`${styles.statusDot} ${u.active ? styles.statusActive : styles.statusOff}`}>
                  {u.active ? 'Активен' : 'Блокирован'}
                </span>
                <div className={styles.rowActions} onClick={e => e.stopPropagation()}>
                  <button className={styles.iconBtn} onClick={() => { setSelectedUser(u); setEditingRole(false); setActionError(null) }} title="Детали"><span className="material-icons-round">visibility</span></button>
                  <button className={styles.iconBtn} onClick={() => void toggleActive(u.id)} title={u.active ? 'Заблокировать' : 'Активировать'}>
                    <span className="material-icons-round">{u.active ? 'block' : 'check_circle'}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {activeTab === 'roles' && (
        <div className={styles.rolesGrid}>
          {ROLES_ORDER.map(role => (
            <div key={role} className={styles.roleCard} style={{ borderLeft: `3px solid ${ROLE_COLORS[role]}` }}>
              <div className={styles.roleHeader}>
                <span className="material-icons-round" style={{ color: ROLE_COLORS[role] }}>admin_panel_settings</span>
                <div>
                  <div className={styles.roleName}>{ROLE_LABELS[role]}</div>
                  <div className={styles.roleCount}>{users.filter(u => u.role === role).length} пользователей</div>
                </div>
              </div>
              <div className={styles.perms}>
                {ROLE_PERMISSIONS[role].map((p, i) => (
                  <div key={i} className={styles.permItem}>
                    <span className={styles.permResource}>{p.resource}</span>
                    <div className={styles.permActions}>
                      {p.actions.map(a => (
                        <span key={a} className={styles.permBadge}>{a === 'read' ? 'Чтение' : a === 'write' ? 'Запись' : a === 'delete' ? 'Удаление' : 'Экспорт'}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'matrix' && (
        <div className={styles.matrixWrapper}>
          <table className={styles.matrix}>
            <thead>
              <tr>
                <th>Ресурс / Действие</th>
                {ROLES_ORDER.map(r => (
                  <th key={r} style={{ color: ROLE_COLORS[r] }}>{ROLE_LABELS[r].split(' ')[0]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {RESOURCES.map(res => (
                <tr key={res}>
                  <td className={styles.resName}>{res}</td>
                  {ROLES_ORDER.map(role => (
                    <td key={role} className={styles.matrixCell}>
                      {(['read', 'write', 'delete', 'export'] as const).map(action => (
                        hasPermission(role, res, action) ? (
                          <span key={action} className={styles.permDot} style={{ background: ROLE_COLORS[role] }} title={action} />
                        ) : (
                          <span key={action} className={styles.permDotEmpty} title={`Нет: ${action}`} />
                        )
                      ))}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <div className={styles.matrixLegend}>
            {(['read', 'write', 'delete', 'export'] as const).map((a, i) => (
              <span key={a} className={styles.legendItem}>
                <span className={styles.legendDot} style={{ background: ['#1a73e8', '#34a853', '#ea4335', '#f9ab00'][i] }} />
                {['Чтение', 'Запись', 'Удаление', 'Экспорт'][i]}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* User detail modal */}
      {selectedUser && (
        <div className={styles.overlay} onClick={() => { setSelectedUser(null); setEditingRole(false) }}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div className={styles.modalTitle}>
                <div className={styles.avatar} style={{ background: ROLE_COLORS[selectedUser.role] + '33', color: ROLE_COLORS[selectedUser.role] }}>
                  {initials(selectedUser.fullName, selectedUser.username)}
                </div>
                {selectedUser.fullName}
              </div>
              <button className={styles.closeBtn} onClick={() => { setSelectedUser(null); setEditingRole(false) }}><span className="material-icons-round">close</span></button>
            </div>
            <div className={styles.modalBody}>
              {!editingRole ? (
                <>
                  <div className={styles.infoGrid}>
                    {[
                      ['Username', selectedUser.username],
                      ['Email', selectedUser.email],
                      ['Роль', ROLE_LABELS[selectedUser.role]],
                      ['Организация', selectedUser.organizationName],
                      ['Последний вход', formatDateTime(selectedUser.lastLogin)],
                      ['Создан', selectedUser.createdAt || '—'],
                    ].map(([k, v]) => (
                      <div key={k} className={styles.infoRow}><span>{k}</span><strong>{v}</strong></div>
                    ))}
                  </div>
                  <div className={styles.permSection}>
                    <h4>Права доступа</h4>
                    {selectedUser.permissions.map((p, i) => (
                      <div key={i} className={styles.permItem}>
                        <span className={styles.permResource}>{p.resource}</span>
                        <div className={styles.permActions}>
                          {p.actions.map(a => <span key={a} className={styles.permBadge}>{a}</span>)}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className={styles.modalActions}>
                    <button className={styles.cancelBtn} onClick={() => { setSelectedUser(null); setEditingRole(false) }}>Закрыть</button>
                    {canUseRbacApi && (
                      <button type="button" className={styles.saveBtn} onClick={openRoleEdit}>
                        <span className="material-icons-round">edit</span> Изменить роль
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div className={styles.formGroup}>
                    <label>Новая роль</label>
                    <select className={styles.select} value={draftRole} onChange={e => setDraftRole(e.target.value as AppRole)}>
                      {assignableRoles.map(r => (
                        <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                      ))}
                    </select>
                  </div>
                  <div className={styles.modalActions}>
                    <button type="button" className={styles.cancelBtn} onClick={() => setEditingRole(false)} disabled={savingRole}>Назад</button>
                    <button type="button" className={styles.saveBtn} onClick={() => void saveRole()} disabled={savingRole}>
                      <span className="material-icons-round">save</span> {savingRole ? 'Сохранение…' : 'Сохранить'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {showInvite && (
        <div className={styles.overlay} onClick={() => setShowInvite(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()} style={{ maxWidth: 560 }}>
            <div className={styles.modalHeader}>
              <div className={styles.modalTitle}><span className="material-icons-round">person_add</span> Пригласить пользователя</div>
              <button type="button" className={styles.closeBtn} onClick={() => setShowInvite(false)}><span className="material-icons-round">close</span></button>
            </div>
            <div className={styles.modalBody}>
              {inviteError && (
                <div className={styles.infoMsg} style={{ marginBottom: 12, borderColor: '#ea4335', background: '#fce8e6' }}>
                  <span className="material-icons-round" style={{ color: '#ea4335' }}>error_outline</span> {inviteError}
                </div>
              )}
              {inviteSuccess && (
                <div className={styles.infoMsg} style={{ marginBottom: 12, borderColor: '#34a853', background: '#e6f4ea' }}>
                  <span className="material-icons-round" style={{ color: '#34a853' }}>check_circle</span>
                  Приглашение создано.
                  {inviteSuccess.invitedEmail
                    ? (inviteSuccess.emailSent
                      ? ' Письмо отправлено на указанный email.'
                      : ' Почта не ушла (проверьте SMTP в auth-service) — отправьте ссылку вручную.')
                    : ' Передайте ссылку или код приглашённому любым способом.'}
                </div>
              )}
              {inviteSuccess && (
                <div className={styles.formGroup}>
                  <label>Ссылка для регистрации</label>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <code className={styles.input} style={{ flex: 1, minWidth: 200, padding: '8px 10px', fontSize: 12, wordBreak: 'break-all' }}>{inviteSuccess.registerUrl}</code>
                    <button type="button" className={styles.saveBtn} onClick={() => void navigator.clipboard.writeText(inviteSuccess.registerUrl)}>
                      <span className="material-icons-round" style={{ fontSize: 18 }}>content_copy</span> Копировать
                    </button>
                  </div>
                </div>
              )}
              {inviteSuccess && (
                <div className={styles.formGroup}>
                  <label>Код приглашения</label>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <code className={styles.input} style={{ flex: 1, minWidth: 120, padding: '8px 10px', fontSize: 13 }}>{inviteSuccess.code}</code>
                    <button type="button" className={styles.saveBtn} onClick={() => void navigator.clipboard.writeText(inviteSuccess.code)}>
                      <span className="material-icons-round" style={{ fontSize: 18 }}>content_copy</span>
                    </button>
                  </div>
                </div>
              )}
              <div className={styles.formGroup}>
                <label>Email приглашённого (необязательно)</label>
                <input className={styles.input} type="email" placeholder="user@company.ru" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} />
                <span style={{ fontSize: 12, color: '#5f6368' }}>Если указать — письмо со ссылкой и регистрация только с этим email.</span>
              </div>
              {isPlatformAdmin && (
                <div className={styles.formGroup}>
                  <label>ID организации</label>
                  <input className={styles.input} type="number" min={1} placeholder="Например, 1" value={inviteOrgId} onChange={e => setInviteOrgId(e.target.value)} />
                </div>
              )}
              <div className={styles.formGroup}>
                <label>Роль после регистрации</label>
                <select className={styles.select} value={inviteAppRole} onChange={e => setInviteAppRole(e.target.value as AppRole)}>
                  {ROLES_ORDER.filter(r => r !== 'super_admin').map(r => (
                    <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                  ))}
                </select>
              </div>
              <div className={styles.formGroup}>
                <label>Срок действия (дней)</label>
                <input className={styles.input} type="number" min={1} max={365} value={inviteExpiresDays} onChange={e => setInviteExpiresDays(Number(e.target.value) || 14)} />
              </div>
              <div className={styles.modalActions}>
                <button type="button" className={styles.cancelBtn} onClick={() => setShowInvite(false)}>Закрыть</button>
                <button type="button" className={styles.saveBtn} onClick={() => void submitInvite()} disabled={inviteSubmitting}>
                  <span className="material-icons-round">add_link</span> {inviteSubmitting ? 'Создание…' : 'Создать приглашение'}
                </button>
              </div>
              <h4 style={{ margin: '20px 0 8px', fontSize: 15 }}>Активные и недавние коды</h4>
              {invitesLoading && <p className={styles.sub}>Загрузка…</p>}
              {!invitesLoading && pendingInvites.length === 0 && <p className={styles.sub}>Пока нет записей</p>}
              {!invitesLoading && pendingInvites.length > 0 && (
                <div style={{ maxHeight: 220, overflow: 'auto', border: '1px solid #e8eaed', borderRadius: 8 }}>
                  <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#f8f9fa', textAlign: 'left' }}>
                        <th style={{ padding: 8 }}>Код</th>
                        <th style={{ padding: 8 }}>Роль</th>
                        <th style={{ padding: 8 }}>Email</th>
                        <th style={{ padding: 8 }}>Статус</th>
                        <th style={{ padding: 8 }} />
                      </tr>
                    </thead>
                    <tbody>
                      {pendingInvites.map(inv => (
                        <tr key={inv.code} style={{ borderTop: '1px solid #e8eaed' }}>
                          <td style={{ padding: 8, wordBreak: 'break-all' }}>{inv.code}</td>
                          <td style={{ padding: 8 }}>{inv.defaultAppRole}</td>
                          <td style={{ padding: 8 }}>{inv.invitedEmail || '—'}</td>
                          <td style={{ padding: 8 }}>{inv.usedAt ? 'Использован' : 'Активен'}</td>
                          <td style={{ padding: 8 }}>
                            {!inv.usedAt && (
                              <button type="button" className={styles.iconBtn} title="Отозвать" onClick={() => void revokeInviteCode(inv.code)}>
                                <span className="material-icons-round">delete</span>
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default RbacManagementPage
