import React, { useEffect, useState } from 'react'
import styles from './EquipmentPage.module.scss'
import { Device, DeviceStatus, DeviceType } from '@domain/entities/Equipment'
import { opsApi } from '@infrastructure/api/OpsApi'

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

const SignalBar: React.FC<{ value: number }> = ({ value }) => {
  const color = value > 70 ? '#34a853' : value > 40 ? '#f9ab00' : '#ea4335'
  return (
    <div className={styles.signalBar}>
      {[25, 50, 75, 100].map(t => (
        <div key={t} className={styles.signalSegment} style={{ background: value >= t ? color : '#e8eaed', height: t / 25 * 4 + 8 }} />
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

  useEffect(() => {
    opsApi.getEquipment().then(setDevices).catch(() => setDevices([]))
  }, [])

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

  const avgUptime = devices.length ? (devices.reduce((s, d) => s + d.sla.uptime, 0) / devices.length).toFixed(1) : '0.0'
  const avgQuality = devices.length ? (devices.reduce((s, d) => s + d.sla.dataQuality, 0) / devices.length).toFixed(1) : '0.0'

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}><span className="material-icons-round">device_hub</span> Техника и сенсоры</h1>
          <p className={styles.sub}>Телеметрия, диагностика, качество сигнала и SLA устройств</p>
        </div>
        <button className={styles.addBtn}>
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
          {(['all', 'online', 'warning', 'error', 'offline'] as const).map(s => (
            <button key={s} className={`${styles.chip} ${filterStatus === s ? styles.activeChip : ''}`}
              onClick={() => setFilterStatus(s)}
              style={filterStatus === s && s !== 'all' ? { background: STATUS_COLORS[s as DeviceStatus] + '22', color: STATUS_COLORS[s as DeviceStatus], borderColor: STATUS_COLORS[s as DeviceStatus] } : {}}>
              {s === 'all' ? 'Все' : STATUS_LABELS[s as DeviceStatus]}
            </button>
          ))}
        </div>
        <div className={styles.filterGroup}>
          <span className={styles.filterLabel}>Тип:</span>
          <button className={`${styles.chip} ${filterType === 'all' ? styles.activeChip : ''}`} onClick={() => setFilterType('all')}>Все</button>
          {(Object.keys(TYPE_LABELS) as DeviceType[]).map(t => (
            <button key={t} className={`${styles.chip} ${filterType === t ? styles.activeChip : ''}`} onClick={() => setFilterType(t)}>
              {TYPE_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      {/* Device grid */}
      <div className={styles.deviceGrid}>
        {filtered.map(d => (
          <div key={d.id} className={`${styles.deviceCard} ${styles[`status_${d.status}`]}`} onClick={() => setSelected(d)}>
            <div className={styles.deviceTop}>
              <div className={styles.deviceIcon}>
                <span className="material-icons-round" style={{ color: STATUS_COLORS[d.status] }}>{TYPE_ICONS[d.type]}</span>
              </div>
              <div className={styles.deviceStatusDot} style={{ background: STATUS_COLORS[d.status] }} />
            </div>
            <div className={styles.deviceName}>{d.name}</div>
            <div className={styles.deviceType}>{TYPE_LABELS[d.type]}</div>
            <div className={styles.deviceField}><span className="material-icons-round" style={{ fontSize: 13 }}>grass</span> {d.fieldName}</div>
            <div className={styles.deviceMetrics}>
              <div className={styles.metricRow}>
                <span className="material-icons-round" style={{ fontSize: 14 }}>battery_charging_full</span>
                <BatteryIcon value={d.battery} />
              </div>
              <div className={styles.metricRow}>
                <span className="material-icons-round" style={{ fontSize: 14 }}>signal_cellular_alt</span>
                <SignalBar value={d.signal} />
              </div>
            </div>
            {d.alerts.length > 0 && (
              <div className={styles.deviceAlerts}>
                {d.alerts.map((a, i) => (
                  <div key={i} className={styles.alertBadge}>
                    <span className="material-icons-round" style={{ fontSize: 12 }}>warning</span> {a}
                  </div>
                ))}
              </div>
            )}
            <div className={styles.devicePing}>
              Последний сигнал: {new Date(d.lastPing).toLocaleString('ru-RU', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}
            </div>
          </div>
        ))}
      </div>

      {/* Device detail */}
      {selected && (
        <div className={styles.overlay} onClick={() => setSelected(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div className={styles.modalTitle}>
                <span className="material-icons-round" style={{ color: STATUS_COLORS[selected.status] }}>{TYPE_ICONS[selected.type]}</span>
                {selected.name}
                <span className={styles.statusBadge} style={{ background: STATUS_COLORS[selected.status] + '22', color: STATUS_COLORS[selected.status] }}>
                  {STATUS_LABELS[selected.status]}
                </span>
              </div>
              <button className={styles.closeBtn} onClick={() => setSelected(null)}><span className="material-icons-round">close</span></button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.detailGrid}>
                <div className={styles.detailSection}>
                  <h4>Информация</h4>
                  {[
                    ['Тип', TYPE_LABELS[selected.type]],
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
                      <div style={{ width: `${selected.sla.uptime}%`, background: selected.sla.uptime > 95 ? '#34a853' : '#f9ab00' }} />
                    </div>
                    <strong>{selected.sla.uptime}%</strong>
                  </div>
                  <div className={styles.slaRow}>
                    <span>Кач. данных</span>
                    <div className={styles.slaBar}>
                      <div style={{ width: `${selected.sla.dataQuality}%`, background: selected.sla.dataQuality > 95 ? '#34a853' : '#f9ab00' }} />
                    </div>
                    <strong>{selected.sla.dataQuality}%</strong>
                  </div>
                  <div className={styles.infoRow}><span>Пропущено показаний</span><strong style={{ color: selected.sla.missedReadings > 10 ? '#ea4335' : '#34a853' }}>{selected.sla.missedReadings}</strong></div>
                </div>
                {Object.keys(selected.telemetry).filter(k => k !== 'lat' && k !== 'lng').length > 0 && (
                  <div className={styles.detailSection}>
                    <h4>Телеметрия</h4>
                    {selected.telemetry.temperature !== undefined && <div className={styles.infoRow}><span>Температура</span><strong>{selected.telemetry.temperature} °C</strong></div>}
                    {selected.telemetry.humidity !== undefined && <div className={styles.infoRow}><span>Влажность</span><strong>{selected.telemetry.humidity}%</strong></div>}
                    {selected.telemetry.soilMoisture !== undefined && <div className={styles.infoRow}><span>Вл. почвы</span><strong>{selected.telemetry.soilMoisture}%</strong></div>}
                    {selected.telemetry.pressure !== undefined && <div className={styles.infoRow}><span>Давление</span><strong>{selected.telemetry.pressure} гПа</strong></div>}
                    {selected.telemetry.windSpeed !== undefined && <div className={styles.infoRow}><span>Ветер</span><strong>{selected.telemetry.windSpeed} м/с</strong></div>}
                    <div className={styles.infoRow}><span>Координаты</span><strong>{selected.telemetry.lat.toFixed(4)}, {selected.telemetry.lng.toFixed(4)}</strong></div>
                  </div>
                )}
              </div>
              {selected.alerts.length > 0 && (
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
    </div>
  )
}

export default EquipmentPage
