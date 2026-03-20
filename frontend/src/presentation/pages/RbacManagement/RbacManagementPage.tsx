import React, { useState } from 'react'
import styles from './RbacManagementPage.module.scss'
import { RbacUser, AppRole, ROLE_LABELS, ROLE_PERMISSIONS } from '@domain/entities/RbacUser'

const MOCK_USERS: RbacUser[] = [
  { id: 'u1', username: 'admin', fullName: 'Администратор Системы', email: 'admin@agro.ru', role: 'super_admin', organizationId: 'org1', organizationName: 'ООО АгроКомплекс', farmIds: ['farm1', 'farm2'], fieldIds: [], lastLogin: '2026-03-20T14:18:32Z', createdAt: '2025-01-15', active: true, permissions: ROLE_PERMISSIONS.super_admin },
  { id: 'u2', username: 'agronomist1', fullName: 'Петров Александр Сергеевич', email: 'agro1@agro.ru', role: 'agronomist', organizationId: 'org1', organizationName: 'ООО АгроКомплекс', farmIds: ['farm1'], fieldIds: ['f1', 'f2', 'f3'], lastLogin: '2026-03-20T14:05:11Z', createdAt: '2025-03-01', active: true, permissions: ROLE_PERMISSIONS.agronomist },
  { id: 'u3', username: 'operator1', fullName: 'Иванов Иван Иванович', email: 'operator1@agro.ru', role: 'operator', organizationId: 'org1', organizationName: 'ООО АгроКомплекс', farmIds: ['farm1'], fieldIds: ['f1', 'f4'], lastLogin: '2026-03-20T12:58:44Z', createdAt: '2025-04-10', active: true, permissions: ROLE_PERMISSIONS.operator },
  { id: 'u4', username: 'viewer1', fullName: 'Сидоров Виктор Дмитриевич', email: 'viewer1@agro.ru', role: 'viewer', organizationId: 'org1', organizationName: 'ООО АгроКомплекс', farmIds: [], fieldIds: [], lastLogin: '2026-03-18T09:30:00Z', createdAt: '2025-06-20', active: true, permissions: ROLE_PERMISSIONS.viewer },
  { id: 'u5', username: 'operator2', fullName: 'Николаев Кирилл Романович', email: 'operator2@agro.ru', role: 'operator', organizationId: 'org1', organizationName: 'ООО АгроКомплекс', farmIds: ['farm2'], fieldIds: ['f2', 'f3'], lastLogin: '2026-03-19T17:00:00Z', createdAt: '2025-07-01', active: false, permissions: ROLE_PERMISSIONS.operator },
  { id: 'u6', username: 'orgadmin', fullName: 'Козлов Михаил Юрьевич', email: 'orgadmin@agro.ru', role: 'org_admin', organizationId: 'org1', organizationName: 'ООО АгроКомплекс', farmIds: ['farm1', 'farm2'], fieldIds: [], lastLogin: '2026-03-17T10:00:00Z', createdAt: '2025-02-01', active: true, permissions: ROLE_PERMISSIONS.org_admin },
]

const ROLE_COLORS: Record<AppRole, string> = {
  super_admin: '#9c27b0', org_admin: '#1a73e8', agronomist: '#34a853', operator: '#f9ab00', viewer: '#9aa0a6',
}

const RbacManagementPage: React.FC = () => {
  const [users, setUsers] = useState<RbacUser[]>(MOCK_USERS)
  const [selectedUser, setSelectedUser] = useState<RbacUser | null>(null)
  const [activeTab, setActiveTab] = useState<'users' | 'roles' | 'matrix'>('users')
  const [showInvite, setShowInvite] = useState(false)
  const [filterRole, setFilterRole] = useState<AppRole | 'all'>('all')

  const toggleActive = (id: string) => {
    setUsers(prev => prev.map(u => u.id === id ? { ...u, active: !u.active } : u))
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
    return perms.some(p => (p.resource === 'Все' || p.resource === resource) && p.actions.includes(action as any))
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}><span className="material-icons-round">manage_accounts</span> Роли и права доступа</h1>
          <p className={styles.sub}>RBAC: управление пользователями, ролями и разграничением доступа</p>
        </div>
        <button className={styles.addBtn} onClick={() => setShowInvite(true)}>
          <span className="material-icons-round">person_add</span> Пригласить
        </button>
      </div>

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
          <div className={styles.userTable}>
            <div className={styles.tableHeader}>
              <span>Пользователь</span><span>Роль</span><span>Организация</span><span>Последний вход</span><span>Статус</span><span></span>
            </div>
            {filtered.map(u => (
              <div key={u.id} className={`${styles.tableRow} ${!u.active ? styles.rowInactive : ''}`} onClick={() => setSelectedUser(u)}>
                <div className={styles.userCell}>
                  <div className={styles.avatar} style={{ background: ROLE_COLORS[u.role] + '33', color: ROLE_COLORS[u.role] }}>
                    {u.fullName.split(' ').map(w => w[0]).slice(0, 2).join('')}
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
                <span className={styles.loginCell}>{new Date(u.lastLogin).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                <span className={`${styles.statusDot} ${u.active ? styles.statusActive : styles.statusOff}`}>
                  {u.active ? 'Активен' : 'Блокирован'}
                </span>
                <div className={styles.rowActions} onClick={e => e.stopPropagation()}>
                  <button className={styles.iconBtn} onClick={() => setSelectedUser(u)} title="Детали"><span className="material-icons-round">visibility</span></button>
                  <button className={styles.iconBtn} onClick={() => toggleActive(u.id)} title={u.active ? 'Заблокировать' : 'Активировать'}>
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
                      {['read', 'write', 'delete', 'export'].map(action => (
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
            {['read', 'write', 'delete', 'export'].map((a, i) => (
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
        <div className={styles.overlay} onClick={() => setSelectedUser(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div className={styles.modalTitle}>
                <div className={styles.avatar} style={{ background: ROLE_COLORS[selectedUser.role] + '33', color: ROLE_COLORS[selectedUser.role] }}>
                  {selectedUser.fullName.split(' ').map(w => w[0]).slice(0, 2).join('')}
                </div>
                {selectedUser.fullName}
              </div>
              <button className={styles.closeBtn} onClick={() => setSelectedUser(null)}><span className="material-icons-round">close</span></button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.infoGrid}>
                {[['Username', selectedUser.username], ['Email', selectedUser.email], ['Роль', ROLE_LABELS[selectedUser.role]], ['Организация', selectedUser.organizationName], ['Последний вход', new Date(selectedUser.lastLogin).toLocaleString('ru-RU')], ['Создан', selectedUser.createdAt]].map(([k, v]) => (
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
                <button className={styles.cancelBtn} onClick={() => setSelectedUser(null)}>Закрыть</button>
                <button className={styles.saveBtn}>
                  <span className="material-icons-round">edit</span> Изменить роль
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showInvite && (
        <div className={styles.overlay} onClick={() => setShowInvite(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div className={styles.modalTitle}><span className="material-icons-round">person_add</span> Пригласить пользователя</div>
              <button className={styles.closeBtn} onClick={() => setShowInvite(false)}><span className="material-icons-round">close</span></button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.formGroup}><label>Email</label><input className={styles.input} type="email" placeholder="user@company.ru" /></div>
              <div className={styles.formGroup}><label>Полное имя</label><input className={styles.input} placeholder="Иванов Иван Иванович" /></div>
              <div className={styles.formGroup}><label>Роль</label>
                <select className={styles.select}>
                  {ROLES_ORDER.filter(r => r !== 'super_admin').map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                </select>
              </div>
              <div className={styles.infoMsg}><span className="material-icons-round">info</span> Пользователь получит email с ссылкой для создания пароля</div>
              <div className={styles.modalActions}>
                <button className={styles.cancelBtn} onClick={() => setShowInvite(false)}>Отмена</button>
                <button className={styles.saveBtn} onClick={() => setShowInvite(false)}>
                  <span className="material-icons-round">send</span> Отправить приглашение
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default RbacManagementPage
