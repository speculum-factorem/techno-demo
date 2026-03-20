import React, { useState } from 'react'
import styles from './NotificationRulesPage.module.scss'
import { NotificationRule, RuleConditionField, RuleOperator, RuleChannel } from '@domain/entities/NotificationRule'

const MOCK_RULES: NotificationRule[] = [
  {
    id: 'r1', name: 'Критический дефицит влаги', description: 'Сигнал, когда влажность почвы критически низкая', enabled: true,
    conditions: [{ field: 'soilMoisture', operator: 'lt', value: 15, unit: '%' }],
    conditionLogic: 'AND', channels: ['app', 'email', 'telegram'], recipients: ['admin@agro.ru', 'agro1@agro.ru'],
    fieldIds: ['f1', 'f2', 'f3', 'f4'], cooldownMinutes: 60, createdBy: 'admin', createdAt: '2026-03-01',
    lastTriggered: '2026-03-19T08:22:00Z', triggerCount: 4,
  },
  {
    id: 'r2', name: 'Жара + засуха', description: 'Комбинация высокой температуры и сухости почвы',
    enabled: true,
    conditions: [
      { field: 'temperature', operator: 'gt', value: 35, unit: '°C' },
      { field: 'soilMoisture', operator: 'lt', value: 20, unit: '%' },
    ],
    conditionLogic: 'AND', channels: ['app', 'telegram'], recipients: ['admin@agro.ru'],
    fieldIds: ['f2', 'f4'], cooldownMinutes: 120, createdBy: 'agronomist1', createdAt: '2026-03-05',
    lastTriggered: '2026-03-15T14:11:00Z', triggerCount: 2,
  },
  {
    id: 'r3', name: 'Сильный ветер', description: 'Уведомление при опасном ветре для опрыскивания',
    enabled: false,
    conditions: [{ field: 'windSpeed', operator: 'gt', value: 8, unit: 'м/с' }],
    conditionLogic: 'AND', channels: ['app'], recipients: ['operator1@agro.ru'],
    fieldIds: ['f1', 'f3'], cooldownMinutes: 30, createdBy: 'agronomist1', createdAt: '2026-03-10',
    triggerCount: 0,
  },
  {
    id: 'r4', name: 'Низкий NDVI', description: 'Деградация вегетации на полях',
    enabled: true,
    conditions: [{ field: 'ndvi', operator: 'lt', value: 0.4, unit: '' }],
    conditionLogic: 'AND', channels: ['email'], recipients: ['admin@agro.ru', 'agro1@agro.ru', 'manager@agro.ru'],
    fieldIds: ['f1', 'f2', 'f3', 'f4'], cooldownMinutes: 1440, createdBy: 'admin', createdAt: '2026-03-12',
    lastTriggered: '2026-03-18T06:00:00Z', triggerCount: 1,
  },
]

const FIELD_LABELS: Record<RuleConditionField, string> = {
  soilMoisture: 'Влажность почвы', temperature: 'Температура', humidity: 'Влажность воздуха',
  rainfall: 'Осадки', windSpeed: 'Скорость ветра', ndvi: 'NDVI',
}

const OP_LABELS: Record<RuleOperator, string> = {
  lt: '<', lte: '≤', gt: '>', gte: '≥', eq: '=',
}

const CHANNEL_ICONS: Record<RuleChannel, string> = {
  app: 'notifications', email: 'email', telegram: 'send',
}

const CHANNEL_LABELS: Record<RuleChannel, string> = {
  app: 'Приложение', email: 'Email', telegram: 'Telegram',
}

const NotificationRulesPage: React.FC = () => {
  const [rules, setRules] = useState<NotificationRule[]>(MOCK_RULES)
  const [showBuilder, setShowBuilder] = useState(false)
  const [editRule, setEditRule] = useState<NotificationRule | null>(null)

  // New rule form state
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newField, setNewField] = useState<RuleConditionField>('soilMoisture')
  const [newOp, setNewOp] = useState<RuleOperator>('lt')
  const [newValue, setNewValue] = useState(20)
  const [newChannels, setNewChannels] = useState<RuleChannel[]>(['app'])
  const [newLogic, setNewLogic] = useState<'AND' | 'OR'>('AND')

  const toggleRule = (id: string) => {
    setRules(prev => prev.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r))
  }

  const deleteRule = (id: string) => {
    setRules(prev => prev.filter(r => r.id !== id))
  }

  const toggleChannel = (ch: RuleChannel) => {
    setNewChannels(prev => prev.includes(ch) ? prev.filter(c => c !== ch) : [...prev, ch])
  }

  const saveRule = () => {
    if (!newName.trim()) return
    const rule: NotificationRule = {
      id: `r${Date.now()}`, name: newName, description: newDesc, enabled: true,
      conditions: [{ field: newField, operator: newOp, value: newValue, unit: newField === 'soilMoisture' || newField === 'humidity' ? '%' : newField === 'ndvi' ? '' : newField === 'windSpeed' ? 'м/с' : '°C' }],
      conditionLogic: newLogic, channels: newChannels, recipients: [],
      fieldIds: ['f1', 'f2', 'f3', 'f4'], cooldownMinutes: 60, createdBy: 'admin', createdAt: new Date().toISOString().slice(0, 10), triggerCount: 0,
    }
    setRules(prev => [rule, ...prev])
    setShowBuilder(false)
    setNewName(''); setNewDesc(''); setNewValue(20)
  }

  const stats = {
    total: rules.length, active: rules.filter(r => r.enabled).length,
    triggered: rules.reduce((s, r) => s + r.triggerCount, 0),
    channels: { app: rules.filter(r => r.channels.includes('app')).length, email: rules.filter(r => r.channels.includes('email')).length, telegram: rules.filter(r => r.channels.includes('telegram')).length },
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}><span className="material-icons-round">rule</span> Правила уведомлений</h1>
          <p className={styles.sub}>Автоматические алерты по условиям сенсоров и индексов</p>
        </div>
        <button className={styles.addBtn} onClick={() => setShowBuilder(true)}>
          <span className="material-icons-round">add_alert</span> Новое правило
        </button>
      </div>

      {/* Stats */}
      <div className={styles.statsRow}>
        <div className={styles.statCard}><span className="material-icons-round" style={{ color: '#1a73e8' }}>rule</span><strong>{stats.total}</strong><span>Правил</span></div>
        <div className={styles.statCard}><span className="material-icons-round" style={{ color: '#34a853' }}>toggle_on</span><strong>{stats.active}</strong><span>Активных</span></div>
        <div className={styles.statCard}><span className="material-icons-round" style={{ color: '#ea4335' }}>notifications_active</span><strong>{stats.triggered}</strong><span>Сработало</span></div>
        <div className={styles.statCard}><span className="material-icons-round" style={{ color: '#1a73e8' }}>notifications</span><strong>{stats.channels.app}</strong><span>В приложении</span></div>
        <div className={styles.statCard}><span className="material-icons-round" style={{ color: '#f9ab00' }}>email</span><strong>{stats.channels.email}</strong><span>Email</span></div>
        <div className={styles.statCard}><span className="material-icons-round" style={{ color: '#34a853' }}>send</span><strong>{stats.channels.telegram}</strong><span>Telegram</span></div>
      </div>

      {/* Rules list */}
      <div className={styles.rulesList}>
        {rules.map(rule => (
          <div key={rule.id} className={`${styles.ruleCard} ${!rule.enabled ? styles.ruleDisabled : ''}`}>
            <div className={styles.ruleTop}>
              <div className={styles.ruleName}>
                <span className="material-icons-round" style={{ color: rule.enabled ? '#34a853' : '#9aa0a6', fontSize: 20 }}>
                  {rule.enabled ? 'notifications_active' : 'notifications_off'}
                </span>
                {rule.name}
              </div>
              <div className={styles.ruleActions}>
                <button className={styles.iconBtn} onClick={() => setEditRule(rule)} title="Изменить">
                  <span className="material-icons-round">edit</span>
                </button>
                <button className={styles.iconBtn} onClick={() => deleteRule(rule.id)} title="Удалить">
                  <span className="material-icons-round">delete</span>
                </button>
                <label className={styles.toggle}>
                  <input type="checkbox" checked={rule.enabled} onChange={() => toggleRule(rule.id)} />
                  <span className={styles.toggleSlider} />
                </label>
              </div>
            </div>

            <p className={styles.ruleDesc}>{rule.description}</p>

            {/* Conditions */}
            <div className={styles.conditions}>
              {rule.conditions.map((c, i) => (
                <React.Fragment key={i}>
                  {i > 0 && <span className={styles.condLogic}>{rule.conditionLogic}</span>}
                  <div className={styles.condBadge}>
                    <span className="material-icons-round" style={{ fontSize: 13 }}>functions</span>
                    {FIELD_LABELS[c.field]} {OP_LABELS[c.operator]} {c.value}{c.unit}
                  </div>
                </React.Fragment>
              ))}
            </div>

            {/* Channels + meta */}
            <div className={styles.ruleMeta}>
              <div className={styles.channels}>
                {rule.channels.map(ch => (
                  <span key={ch} className={styles.channelBadge}>
                    <span className="material-icons-round" style={{ fontSize: 13 }}>{CHANNEL_ICONS[ch]}</span>
                    {CHANNEL_LABELS[ch]}
                  </span>
                ))}
              </div>
              <div className={styles.ruleStat}>
                <span className="material-icons-round" style={{ fontSize: 13 }}>timer</span>
                Кулдаун: {rule.cooldownMinutes >= 60 ? `${rule.cooldownMinutes / 60} ч` : `${rule.cooldownMinutes} мин`}
              </div>
              {rule.lastTriggered && (
                <div className={styles.ruleStat}>
                  <span className="material-icons-round" style={{ fontSize: 13 }}>notifications_active</span>
                  Последний: {new Date(rule.lastTriggered).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  <span className={styles.triggerCount}>×{rule.triggerCount}</span>
                </div>
              )}
              <div className={styles.ruleStat}>
                <span className="material-icons-round" style={{ fontSize: 13 }}>person</span>
                {rule.createdBy}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Rule builder modal */}
      {showBuilder && (
        <div className={styles.overlay} onClick={() => setShowBuilder(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div className={styles.modalTitle}><span className="material-icons-round">add_alert</span> Новое правило</div>
              <button className={styles.closeBtn} onClick={() => setShowBuilder(false)}><span className="material-icons-round">close</span></button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.formGroup}>
                <label>Название правила</label>
                <input className={styles.input} value={newName} onChange={e => setNewName(e.target.value)} placeholder="Например: Жара + засуха" />
              </div>
              <div className={styles.formGroup}>
                <label>Описание</label>
                <input className={styles.input} value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Краткое описание условия" />
              </div>

              <div className={styles.condBuilder}>
                <label>Условие триггера</label>
                <div className={styles.condRow}>
                  <select className={styles.select} value={newField} onChange={e => setNewField(e.target.value as RuleConditionField)}>
                    {(Object.keys(FIELD_LABELS) as RuleConditionField[]).map(f => <option key={f} value={f}>{FIELD_LABELS[f]}</option>)}
                  </select>
                  <select className={styles.selectSmall} value={newOp} onChange={e => setNewOp(e.target.value as RuleOperator)}>
                    {(Object.keys(OP_LABELS) as RuleOperator[]).map(op => <option key={op} value={op}>{OP_LABELS[op]}</option>)}
                  </select>
                  <input type="number" className={styles.inputNum} value={newValue} onChange={e => setNewValue(+e.target.value)} />
                </div>
              </div>

              <div className={styles.formGroup}>
                <label>Каналы уведомлений</label>
                <div className={styles.channelPicker}>
                  {(['app', 'email', 'telegram'] as RuleChannel[]).map(ch => (
                    <label key={ch} className={`${styles.channelOpt} ${newChannels.includes(ch) ? styles.channelOptActive : ''}`}>
                      <input type="checkbox" checked={newChannels.includes(ch)} onChange={() => toggleChannel(ch)} hidden />
                      <span className="material-icons-round">{CHANNEL_ICONS[ch]}</span>
                      {CHANNEL_LABELS[ch]}
                    </label>
                  ))}
                </div>
              </div>

              <div className={styles.modalActions}>
                <button className={styles.cancelBtn} onClick={() => setShowBuilder(false)}>Отмена</button>
                <button className={styles.saveBtn} onClick={saveRule}>
                  <span className="material-icons-round">save</span> Сохранить правило
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {editRule && (
        <div className={styles.overlay} onClick={() => setEditRule(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div className={styles.modalTitle}><span className="material-icons-round">edit</span> {editRule.name}</div>
              <button className={styles.closeBtn} onClick={() => setEditRule(null)}><span className="material-icons-round">close</span></button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.infoMsg}><span className="material-icons-round">info</span> Полный редактор правил доступен в расширенной версии. Базовые настройки можно изменить здесь.</div>
              <div className={styles.formGroup}>
                <label>Название</label>
                <input className={styles.input} defaultValue={editRule.name} />
              </div>
              <div className={styles.formGroup}>
                <label>Кулдаун (минуты)</label>
                <input type="number" className={styles.input} defaultValue={editRule.cooldownMinutes} />
              </div>
              <div className={styles.modalActions}>
                <button className={styles.cancelBtn} onClick={() => setEditRule(null)}>Закрыть</button>
                <button className={styles.saveBtn} onClick={() => setEditRule(null)}>
                  <span className="material-icons-round">save</span> Сохранить
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default NotificationRulesPage
