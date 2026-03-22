import React, { useEffect, useState } from 'react'
import styles from './EquipmentPage.module.scss'
import { Device, DeviceStatus, DeviceType } from '@domain/entities/Equipment'
import { opsApi } from '@infrastructure/api/OpsApi'
import { fieldApi } from '@infrastructure/api/FieldApi'
import { Field } from '@domain/entities/Field'

const STATUS_LABELS: Record<DeviceStatus, string> = {
  online: 'Онлайн', offline: 'Офлайн', warning: 'Предупреждение', error: 'Ошибка',
}
const STATUS_COLORS: Record<DeviceStatus, string> = {
  online: '#34a853', offline: '#9aa0a6', warning: '#f9ab00', error: '#ea4335',
}
const TYPE_ICONS: Record<DeviceType, string> = {
  soil_sensor: 'sensors', weather_station: 'wb_sunny', irrigation_controller: 'water_drop',
  drone: 'flight', tractor: 'agriculture', camera: 'videocam',
}
const TYPE_LABELS: Record<DeviceType, string> = {
  soil_sensor: 'Датчик почвы', weather_station: 'Метеостанция', irrigation_controller: 'Контроллер полива',
  drone: 'БПЛА', tractor: 'Техника', camera: 'Камера',
}
const ALL_TYPES = Object.keys(TYPE_LABELS) as DeviceType[]
const ALL_STATUSES: DeviceStatus[] = ['online', 'offline', 'warning', 'error']

const EMPTY_FORM = {
  name: '',
  type: 'soil_sensor' as DeviceType,
  fieldId: '',
  status: 'online' as DeviceStatus,
  battery: 100,
  signal: 100,
  firmware: '1.0.0',
  installDate: new Date().toISOString().slice(0, 10),
  lat: '',
  lng: '',
  temperature: '',
  humidity: '',
  soilMoisture: '',
}

type FormState = typeof EMPTY_FORM

const SignalBar: React.FC<{ value: number }> = ({ value }) => {
  const color = value > 70 ? '#34a853' : value > 40 ? '#f9ab00' : '#ea4335'
  return (
    <div className={styles.signalBar}>
      {[25, 50, 75, 100].map(t => (
        <div key={t} className={styles.signalSegment}
          style={{ background: value >= t ? color : '#e8eaed', height: t / 25 * 4 + 8 }} />
      ))}
      <span style={{ color, fontSize: 11, fontWeight: 600 }}>{value}%</span>
    </div>
  )
}

const BatteryIcon: React.FC<{ value: number }> = ({ value }) => {
  const color = value > 50 ? '#34a853' : value > 20 ? '#f9ab00' : '#ea4335'
  return (
    <div className={styles.battery}>
      <div className={styles.batteryBody}>
        <div className={styles.batteryFill} style={{ width: `${value}%`, background: color }} />
      </div>
      <div className={styles.batteryTip} />
      <span style={{ color, fontSize: 11, fontWeight: 600 }}>{value}%</span>
    </div>
  )
}

const EquipmentPage: React.FC = () => {
  const [filterStatus, setFilterStatus] = useState<DeviceStatus | 'all'>('all')
  const [filterType, setFilterType] = useState<DeviceType | 'all'>('all')
  const [selected, setSelected] = useState<Device | null>(null)
  const [devices, setDevices] = useState<Device[]>([])
  const [fields, setFields] = useState<Field[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  // Modal state
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)

  const load = () => {
    setLoading(true)
    Promise.all([
      opsApi.getEquipment().catch(() => [] as Device[]),
      fieldApi.getAll().catch(() => [] as Field[]),
    ]).then(([devs, flds]) => {
      setDevices(devs)
      setFields(flds)
    }).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const filtered = devices.filter(d => {
    if (filterStatus !== 'all' && d.status !== filterStatus) return false
    if (filterType !== 'all' && d.type !== filterType) return false
    return true
  })

  const stats = {
    total: devices.length,
    online: devices.filter(d => d.status === 'online').length,
    warning: devices.filter(d => d.status === 'warning').length,
    error: devices.filter(d => d.status === 'error').length,
    offline: devices.filter(d => d.status === 'offline').length,
  }

  const avgUptime = devices.length
    ? (devices.reduce((s, d) => s + (d.sla?.uptime ?? 100), 0) / devices.length).toFixed(1) : '0.0'
  const avgQuality = devices.length
    ? (devices.reduce((s, d) => s + (d.sla?.dataQuality ?? 100), 0) / devices.length).toFixed(1) : '0.0'

  const openAdd = () => {
    setEditingId(null)
    setForm({ ...EMPTY_FORM, fieldId: fields[0]?.id ?? '' })
    setError(null)
    setModalOpen(true)
  }

  const openEdit = (d: Device) => {
    setSelected(null)
    setEditingId(d.id)
    setForm({
      name: d.name,
      type: d.type,
      fieldId: d.fieldId,
      status: d.status,
      battery: d.battery,
      signal: d.signal,
      firmware: d.firmware,
      installDate: d.installDate,
      lat: String(d.telemetry?.lat ?? ''),
      lng: String(d.telemetry?.lng ?? ''),
      temperature: d.telemetry?.temperature !== undefined ? String(d.telemetry.temperature) : '',
      humidity: d.telemetry?.humidity !== undefined ? String(d.telemetry.humidity) : '',
      soilMoisture: d.telemetry?.soilMoisture !== undefined ? String(d.telemetry.soilMoisture) : '',
    })
    setError(null)
    setModalOpen(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) { setError('Введите название устройства'); return }
    if (!form.fieldId) { setError('Выберите поле'); return }
    const selectedField = fields.find(f => f.id === form.fieldId)
    const telemetry: Device['telemetry'] = {
      lat: form.lat ? Number(form.lat) : (selectedField?.coordinates.lat ?? 0),
      lng: form.lng ? Number(form.lng) : (selectedField?.coordinates.lng ?? 0),
      ...(form.temperature !== '' ? { temperature: Number(form.temperature) } : {}),
      ...(form.humidity !== '' ? { humidity: Number(form.humidity) } : {}),
      ...(form.soilMoisture !== '' ? { soilMoisture: Number(form.soilMoisture) } : {}),
    }

    const payload = {
      name: form.name.trim(),
      type: form.type,
      fieldId: form.fieldId,
      fieldName: selectedField?.name ?? '',
      status: form.status,
      battery: form.battery,
      signal: form.signal,
      firmware: form.firmware.trim() || '1.0.0',
      installDate: form.installDate,
      telemetry,
    }
    setSaving(true)
    setError(null)
    try {
      if (editingId) {
        await opsApi.updateEquipment(editingId, payload)
      } else {
        await opsApi.createEquipment(payload as any)
      }
      setModalOpen(false)
      load()
    } catch (err: any) {
      setError(err.response?.data?.detail || err.response?.data?.message || 'Не удалось сохранить устройство')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await opsApi.deleteEquipment(id)
      setDeleteConfirm(null)
      setSelected(null)
      load()
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Не удалось удалить устройство')
    }
  }

  const setF = (key: keyof FormState, val: string | number) =>
    setForm(prev => ({ ...prev, [key]: val }))

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>
            <span className="material-icons-round">device_hub</span> Техника и сенсоры
          </h1>
          <p className={styles.sub}>Телеметрия, диагностика, качество сигнала и SLA устройств</p>
        </div>
        <button className={styles.addBtn} onClick={openAdd}>
          <span className="material-icons-round">add</span> Добавить устройство
        </button>
      </div>

      {/* Summary stats */}
      <div className={styles.summaryRow}>
        {[
          { label: 'Устройств', value: stats.total, icon: 'device_hub', color: '#1a73e8' },
          { label: 'Онлайн', value: stats.online, icon: 'check_circle', color: '#34a853' },
          { label: 'Предупреждений', value: stats.warning, icon: 'warning', color: '#f9ab00' },
          { label: 'Ошибок', value: stats.error, icon: 'error', color: '#ea4335' },
          { label: 'Ср. аптайм', value: `${avgUptime}%`, icon: 'schedule', color: '#34a853' },
          { label: 'Кач. данных', value: `${avgQuality}%`, icon: 'analytics', color: '#1a73e8' },
        ].map(s => (
          <div key={s.label} className={styles.summaryCard}>
            <span className="material-icons-round" style={{ color: s.color, fontSize: 20 }}>{s.icon}</span>
            <span className={styles.summaryValue} style={{ color: s.color }}>{s.value}</span>
            <span className={styles.summaryLabel}>{s.label}</span>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className={styles.filters}>
        <div className={styles.filterGroup}>
          <span className={styles.filterLabel}>Статус:</span>
          {(['all', ...ALL_STATUSES] as const).map(s => (
            <button key={s} className={`${styles.chip} ${filterStatus === s ? styles.activeChip : ''}`}
              onClick={() => setFilterStatus(s)}
              style={filterStatus === s && s !== 'all' ? {
                background: STATUS_COLORS[s as DeviceStatus] + '22',
                color: STATUS_COLORS[s as DeviceStatus],
                borderColor: STATUS_COLORS[s as DeviceStatus],
              } : {}}>
              {s === 'all' ? 'Все' : STATUS_LABELS[s as DeviceStatus]}
            </button>
          ))}
        </div>
        <div className={styles.filterGroup}>
          <span className={styles.filterLabel}>Тип:</span>
          <button className={`${styles.chip} ${filterType === 'all' ? styles.activeChip : ''}`}
            onClick={() => setFilterType('all')}>Все</button>
          {ALL_TYPES.map(t => (
            <button key={t} className={`${styles.chip} ${filterType === t ? styles.activeChip : ''}`}
              onClick={() => setFilterType(t)}>
              {TYPE_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      {/* Device grid */}
      {loading && devices.length === 0 ? (
        <div className={styles.emptyState}>
          <span className="material-icons-round">hourglass_empty</span>
          <p>Загрузка...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className={styles.emptyState}>
          <span className="material-icons-round">device_hub</span>
          <p>{devices.length === 0 ? 'Нет устройств. Добавьте первое!' : 'Нет устройств по выбранным фильтрам'}</p>
          {devices.length === 0 && (
            <button className={styles.addBtn} onClick={openAdd} style={{ marginTop: 12 }}>
              <span className="material-icons-round">add</span> Добавить устройство
            </button>
          )}
        </div>
      ) : (
        <div className={styles.deviceGrid}>
          {filtered.map(d => (
            <div key={d.id} className={`${styles.deviceCard} ${styles[`status_${d.status}`]}`}
              onClick={() => setSelected(d)}>
              <div className={styles.deviceTop}>
                <div className={styles.deviceIcon}>
                  <span className="material-icons-round" style={{ color: STATUS_COLORS[d.status] }}>
                    {TYPE_ICONS[d.type]}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <button className={styles.iconActionBtn} title="Редактировать"
                    onClick={e => { e.stopPropagation(); openEdit(d) }}>
                    <span className="material-icons-round" style={{ fontSize: 16 }}>edit</span>
                  </button>
                  <button className={`${styles.iconActionBtn} ${styles.deleteBtn}`} title="Удалить"
                    onClick={e => { e.stopPropagation(); setDeleteConfirm(d.id) }}>
                    <span className="material-icons-round" style={{ fontSize: 16 }}>delete</span>
                  </button>
                  <div className={styles.deviceStatusDot} style={{ background: STATUS_COLORS[d.status] }} />
                </div>
              </div>
              <div className={styles.deviceName}>{d.name}</div>
              <div className={styles.deviceType}>{TYPE_LABELS[d.type] ?? d.type}</div>
              <div className={styles.deviceField}>
                <span className="material-icons-round" style={{ fontSize: 13 }}>grass</span> {d.fieldName}
              </div>
              <div className={styles.deviceMetrics}>
                <div className={styles.metricRow}>
                  <span className="material-icons-round" style={{ fontSize: 14 }}>battery_charging_full</span>
                  <BatteryIcon value={d.battery ?? 100} />
                </div>
                <div className={styles.metricRow}>
                  <span className="material-icons-round" style={{ fontSize: 14 }}>signal_cellular_alt</span>
                  <SignalBar value={d.signal ?? 100} />
                </div>
              </div>
              {d.alerts?.length > 0 && (
                <div className={styles.deviceAlerts}>
                  {d.alerts.map((a, i) => (
                    <div key={i} className={styles.alertBadge}>
                      <span className="material-icons-round" style={{ fontSize: 12 }}>warning</span> {a}
                    </div>
                  ))}
                </div>
              )}
              <div className={styles.devicePing}>
                Последний сигнал: {new Date(d.lastPing).toLocaleString('ru-RU', {
                  hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit',
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Device detail modal */}
      {selected && (
        <div className={styles.overlay} onClick={() => setSelected(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div className={styles.modalTitle}>
                <span className="material-icons-round" style={{ color: STATUS_COLORS[selected.status] }}>
                  {TYPE_ICONS[selected.type]}
                </span>
                {selected.name}
                <span className={styles.statusBadge}
                  style={{ background: STATUS_COLORS[selected.status] + '22', color: STATUS_COLORS[selected.status] }}>
                  {STATUS_LABELS[selected.status]}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className={styles.editModalBtn} onClick={() => openEdit(selected)}>
                  <span className="material-icons-round">edit</span> Изменить
                </button>
                <button className={styles.deleteModalBtn} onClick={() => { setDeleteConfirm(selected.id); setSelected(null) }}>
                  <span className="material-icons-round">delete</span>
                </button>
                <button className={styles.closeBtn} onClick={() => setSelected(null)}>
                  <span className="material-icons-round">close</span>
                </button>
              </div>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.detailGrid}>
                <div className={styles.detailSection}>
                  <h4>Информация</h4>
                  {[
                    ['Тип', TYPE_LABELS[selected.type] ?? selected.type],
                    ['Поле', selected.fieldName],
                    ['Прошивка', selected.firmware],
                    ['Установлен', selected.installDate],
                    ['Последний сигнал', new Date(selected.lastPing).toLocaleString('ru-RU')],
                  ].map(([k, v]) => (
                    <div key={k} className={styles.infoRow}><span>{k}</span><strong>{v}</strong></div>
                  ))}
                </div>
                <div className={styles.detailSection}>
                  <h4>SLA</h4>
                  <div className={styles.slaRow}>
                    <span>Аптайм</span>
                    <div className={styles.slaBar}>
                      <div style={{
                        width: `${selected.sla?.uptime ?? 100}%`,
                        background: (selected.sla?.uptime ?? 100) > 95 ? '#34a853' : '#f9ab00',
                      }} />
                    </div>
                    <strong>{selected.sla?.uptime ?? 100}%</strong>
                  </div>
                  <div className={styles.slaRow}>
                    <span>Кач. данных</span>
                    <div className={styles.slaBar}>
                      <div style={{
                        width: `${selected.sla?.dataQuality ?? 100}%`,
                        background: (selected.sla?.dataQuality ?? 100) > 95 ? '#34a853' : '#f9ab00',
                      }} />
                    </div>
                    <strong>{selected.sla?.dataQuality ?? 100}%</strong>
                  </div>
                  <div className={styles.infoRow}>
                    <span>Пропущено показаний</span>
                    <strong style={{ color: (selected.sla?.missedReadings ?? 0) > 10 ? '#ea4335' : '#34a853' }}>
                      {selected.sla?.missedReadings ?? 0}
                    </strong>
                  </div>
                </div>
                {Object.keys(selected.telemetry ?? {}).filter(k => k !== 'lat' && k !== 'lng').length > 0 && (
                  <div className={styles.detailSection}>
                    <h4>Телеметрия</h4>
                    {selected.telemetry?.temperature !== undefined && (
                      <div className={styles.infoRow}><span>Температура</span><strong>{selected.telemetry.temperature} °C</strong></div>
                    )}
                    {selected.telemetry?.humidity !== undefined && (
                      <div className={styles.infoRow}><span>Влажность</span><strong>{selected.telemetry.humidity}%</strong></div>
                    )}
                    {selected.telemetry?.soilMoisture !== undefined && (
                      <div className={styles.infoRow}><span>Вл. почвы</span><strong>{selected.telemetry.soilMoisture}%</strong></div>
                    )}
                    {selected.telemetry?.pressure !== undefined && (
                      <div className={styles.infoRow}><span>Давление</span><strong>{selected.telemetry.pressure} гПа</strong></div>
                    )}
                    {selected.telemetry?.windSpeed !== undefined && (
                      <div className={styles.infoRow}><span>Ветер</span><strong>{selected.telemetry.windSpeed} м/с</strong></div>
                    )}
                    {selected.telemetry?.lat !== undefined && (
                      <div className={styles.infoRow}>
                        <span>Координаты</span>
                        <strong>{selected.telemetry.lat.toFixed(4)}, {selected.telemetry.lng.toFixed(4)}</strong>
                      </div>
                    )}
                  </div>
                )}
              </div>
              {selected.alerts?.length > 0 && (
                <div className={styles.modalAlerts}>
                  <h4>Активные алерты</h4>
                  {selected.alerts.map((a, i) => (
                    <div key={i} className={styles.modalAlertItem}>
                      <span className="material-icons-round">warning</span> {a}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit modal */}
      {modalOpen && (
        <div className={styles.overlay} onClick={() => setModalOpen(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div className={styles.modalTitle}>
                <span className="material-icons-round" style={{ color: '#1a73e8' }}>
                  {editingId ? 'edit' : 'add_circle'}
                </span>
                {editingId ? 'Редактировать устройство' : 'Добавить устройство'}
              </div>
              <button className={styles.closeBtn} onClick={() => setModalOpen(false)}>
                <span className="material-icons-round">close</span>
              </button>
            </div>
            <div className={styles.modalBody}>
              <form onSubmit={handleSave} className={styles.addForm}>
                {error && (
                  <div className={styles.formError}>
                    <span className="material-icons-round">error</span> {error}
                  </div>
                )}

                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Название *</label>
                    <input className={styles.formInput} value={form.name}
                      onChange={e => setF('name', e.target.value)}
                      placeholder="Датчик влажности #1" required />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Тип устройства *</label>
                    <select className={styles.formSelect} value={form.type}
                      onChange={e => setF('type', e.target.value as DeviceType)}>
                      {ALL_TYPES.map(t => (
                        <option key={t} value={t}>{TYPE_LABELS[t]}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Поле *</label>
                    <select className={styles.formSelect} value={form.fieldId}
                      onChange={e => setF('fieldId', e.target.value)}>
                      <option value="">— выберите поле —</option>
                      {fields.map(f => (
                        <option key={f.id} value={f.id}>{f.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Статус</label>
                    <select className={styles.formSelect} value={form.status}
                      onChange={e => setF('status', e.target.value as DeviceStatus)}>
                      {ALL_STATUSES.map(s => (
                        <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>
                      Заряд батареи: <strong>{form.battery}%</strong>
                    </label>
                    <input type="range" min={0} max={100} value={form.battery}
                      onChange={e => setF('battery', Number(e.target.value))}
                      className={styles.formRange} />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>
                      Уровень сигнала: <strong>{form.signal}%</strong>
                    </label>
                    <input type="range" min={0} max={100} value={form.signal}
                      onChange={e => setF('signal', Number(e.target.value))}
                      className={styles.formRange} />
                  </div>
                </div>

                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Версия прошивки</label>
                    <input className={styles.formInput} value={form.firmware}
                      onChange={e => setF('firmware', e.target.value)}
                      placeholder="1.0.0" />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Дата установки</label>
                    <input className={styles.formInput} type="date" value={form.installDate}
                      onChange={e => setF('installDate', e.target.value)} />
                  </div>
                </div>

                <div className={styles.formSectionTitle}>
                  <span className="material-icons-round">location_on</span> Координаты
                  <span className={styles.formSectionHint}>(заполнится автоматически из поля если оставить пустым)</span>
                </div>
                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Широта</label>
                    <input className={styles.formInput} type="number" step="any" value={form.lat}
                      onChange={e => setF('lat', e.target.value)}
                      placeholder="47.2200" />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Долгота</label>
                    <input className={styles.formInput} type="number" step="any" value={form.lng}
                      onChange={e => setF('lng', e.target.value)}
                      placeholder="39.7000" />
                  </div>
                </div>

                <div className={styles.formSectionTitle}>
                  <span className="material-icons-round">sensors</span> Начальная телеметрия
                  <span className={styles.formSectionHint}>(необязательно)</span>
                </div>
                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Температура (°C)</label>
                    <input className={styles.formInput} type="number" step="0.1" value={form.temperature}
                      onChange={e => setF('temperature', e.target.value)} placeholder="22.5" />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Влажность воздуха (%)</label>
                    <input className={styles.formInput} type="number" step="0.1" value={form.humidity}
                      onChange={e => setF('humidity', e.target.value)} placeholder="65" />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Влажность почвы (%)</label>
                    <input className={styles.formInput} type="number" step="0.1" value={form.soilMoisture}
                      onChange={e => setF('soilMoisture', e.target.value)} placeholder="55" />
                  </div>
                </div>

                <div className={styles.formActions}>
                  <button type="button" className={styles.cancelBtn} onClick={() => setModalOpen(false)}>
                    Отмена
                  </button>
                  <button type="submit" className={styles.saveBtn} disabled={saving}>
                    {saving
                      ? <><span className="material-icons-round" style={{ animation: 'spin 1s linear infinite', fontSize: 16 }}>autorenew</span> Сохранение...</>
                      : <><span className="material-icons-round" style={{ fontSize: 16 }}>save</span> {editingId ? 'Сохранить' : 'Добавить'}</>
                    }
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteConfirm && (
        <div className={styles.overlay} onClick={() => setDeleteConfirm(null)}>
          <div className={styles.confirmModal} onClick={e => e.stopPropagation()}>
            <span className="material-icons-round" style={{ fontSize: 40, color: '#ea4335' }}>delete_forever</span>
            <h3>Удалить устройство?</h3>
            <p>Это действие необратимо. Устройство и его история будут удалены.</p>
            <div className={styles.confirmActions}>
              <button className={styles.cancelBtn} onClick={() => setDeleteConfirm(null)}>Отмена</button>
              <button className={styles.deleteConfirmBtn} onClick={() => handleDelete(deleteConfirm)}>
                <span className="material-icons-round" style={{ fontSize: 16 }}>delete</span> Удалить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default EquipmentPage
