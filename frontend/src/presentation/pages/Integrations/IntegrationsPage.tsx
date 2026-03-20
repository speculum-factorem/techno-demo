import React, { useState } from 'react'
import styles from './IntegrationsPage.module.scss'
import { Integration, IntegrationStatus, IntegrationType } from '@domain/entities/Integration'

const MOCK_INTEGRATIONS: Integration[] = [
  {
    id: 'i1', type: '1c_erp', name: '1С:Агро / ERP', description: 'Двусторонняя синхронизация справочников, себестоимости, складских остатков и актов выполненных работ',
    icon: '1c_erp', status: 'connected', lastSync: '2026-03-20T10:52:00Z', recordsSynced: 248,
    config: { host: 'erp.agro.ru', port: '8080', database: 'agro_prod' },
    features: ['Синхронизация полей', 'Импорт затрат', 'Экспорт урожая', 'Акты работ'],
  },
  {
    id: 'i2', type: 'weather_api', name: 'OpenWeatherMap API', description: 'Актуальные метеоданные и 16-дневный прогноз погоды с часовым разрешением для всех полей',
    icon: 'cloud', status: 'connected', lastSync: '2026-03-20T14:00:00Z', recordsSynced: 12800,
    config: { api_key: '••••••••••••••••', endpoint: 'api.openweathermap.org' },
    features: ['Текущая погода', '16-дневный прогноз', 'Исторические данные', 'Радар осадков'],
  },
  {
    id: 'i3', type: 'iot_gateway', name: 'IoT Gateway (MQTT)', description: 'Подключение датчиков почвы, метеостанций и контроллеров полива через MQTT-брокер',
    icon: 'device_hub', status: 'connected', lastSync: '2026-03-20T14:20:00Z', recordsSynced: 94200,
    config: { broker: 'mqtt.agro.internal', port: '1883', topic: 'sensors/#' },
    features: ['Датчики почвы', 'Метеостанции', 'Контроллеры полива', 'БПЛА телеметрия'],
  },
  {
    id: 'i4', type: 'geo_import', name: 'GIS / Shapefile Import', description: 'Импорт границ полей и зон из Shapefile, GeoJSON, KML. Экспорт для ГИС-систем',
    icon: 'map', status: 'disconnected',
    config: {},
    features: ['Shapefile (.shp)', 'GeoJSON', 'KML / KMZ', 'WGS84 / СК-42'],
  },
  {
    id: 'i5', type: 'telegram', name: 'Telegram Bot', description: 'Уведомления и дайджесты напрямую в Telegram. Поддержка команд /status, /alerts, /report',
    icon: 'send', status: 'error', lastSync: '2026-03-19T18:00:00Z',
    config: { bot_token: '••••••••••••', chat_id: '-100123456789' },
    features: ['Алерты в реальном времени', 'Еженедельные дайджесты', 'Команды бота', 'Групповые чаты'],
  },
  {
    id: 'i6', type: 'email_smtp', name: 'Email / SMTP', description: 'Отправка отчётов, уведомлений и приглашений пользователей по электронной почте',
    icon: 'email', status: 'connected', lastSync: '2026-03-20T11:47:00Z', recordsSynced: 156,
    config: { host: 'smtp.agro.ru', port: '587', from: 'noreply@agro.ru' },
    features: ['Отчёты PDF/Excel', 'Алерты по правилам', 'Приглашения', 'Дайджесты'],
  },
]

const STATUS_LABELS: Record<IntegrationStatus, string> = {
  connected: 'Подключено', disconnected: 'Не подключено', error: 'Ошибка', pending: 'Ожидание',
}
const STATUS_COLORS: Record<IntegrationStatus, string> = {
  connected: '#34a853', disconnected: '#9aa0a6', error: '#ea4335', pending: '#f9ab00',
}
const STATUS_ICONS: Record<IntegrationStatus, string> = {
  connected: 'check_circle', disconnected: 'radio_button_unchecked', error: 'error', pending: 'pending',
}

const TYPE_ICONS: Record<IntegrationType, string> = {
  '1c_erp': 'account_balance', weather_api: 'cloud', iot_gateway: 'device_hub', geo_import: 'map', telegram: 'send', email_smtp: 'email',
}

const IntegrationsPage: React.FC = () => {
  const [integrations, setIntegrations] = useState<Integration[]>(MOCK_INTEGRATIONS)
  const [selected, setSelected] = useState<Integration | null>(null)
  const [connecting, setConnecting] = useState<string | null>(null)
  const [showImport, setShowImport] = useState(false)

  const connect = (id: string) => {
    setConnecting(id)
    setTimeout(() => {
      setIntegrations(prev => prev.map(i => i.id === id ? { ...i, status: 'connected', lastSync: new Date().toISOString(), recordsSynced: (i.recordsSynced || 0) + 42 } : i))
      setConnecting(null)
    }, 2000)
  }

  const disconnect = (id: string) => {
    setIntegrations(prev => prev.map(i => i.id === id ? { ...i, status: 'disconnected', lastSync: undefined } : i))
  }

  const stats = {
    total: integrations.length,
    connected: integrations.filter(i => i.status === 'connected').length,
    errors: integrations.filter(i => i.status === 'error').length,
    records: integrations.reduce((s, i) => s + (i.recordsSynced || 0), 0),
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}><span className="material-icons-round">cable</span> Интеграции</h1>
          <p className={styles.sub}>1С/ERP, метеоAPI, IoT-шлюзы, GIS, Telegram, Email</p>
        </div>
        <button className={styles.importBtn} onClick={() => setShowImport(true)}>
          <span className="material-icons-round">upload_file</span> Импорт GeoJSON
        </button>
      </div>

      {/* Stats */}
      <div className={styles.statsRow}>
        {[
          { label: 'Интеграций', value: stats.total, icon: 'cable', color: '#1a73e8' },
          { label: 'Подключено', value: stats.connected, icon: 'check_circle', color: '#34a853' },
          { label: 'Ошибок', value: stats.errors, icon: 'error', color: '#ea4335' },
          { label: 'Синхронизировано', value: stats.records.toLocaleString('ru-RU'), icon: 'sync', color: '#f9ab00' },
        ].map(s => (
          <div key={s.label} className={styles.statCard}>
            <span className="material-icons-round" style={{ color: s.color }}>{s.icon}</span>
            <strong style={{ color: s.color }}>{s.value}</strong>
            <span>{s.label}</span>
          </div>
        ))}
      </div>

      {/* Integration cards */}
      <div className={styles.intGrid}>
        {integrations.map(intg => (
          <div key={intg.id} className={`${styles.intCard} ${styles[`status_${intg.status}`]}`} onClick={() => setSelected(intg)}>
            <div className={styles.intTop}>
              <div className={styles.intIcon}>
                <span className="material-icons-round" style={{ color: STATUS_COLORS[intg.status] }}>{TYPE_ICONS[intg.type]}</span>
              </div>
              <div className={styles.intStatus}>
                <span className="material-icons-round" style={{ color: STATUS_COLORS[intg.status], fontSize: 16 }}>{STATUS_ICONS[intg.status]}</span>
                <span style={{ color: STATUS_COLORS[intg.status], fontSize: 12, fontWeight: 600 }}>{STATUS_LABELS[intg.status]}</span>
              </div>
            </div>
            <div className={styles.intName}>{intg.name}</div>
            <div className={styles.intDesc}>{intg.description}</div>
            <div className={styles.intFeatures}>
              {intg.features.slice(0, 3).map(f => (
                <span key={f} className={styles.featurePill}>
                  <span className="material-icons-round" style={{ fontSize: 11 }}>check</span> {f}
                </span>
              ))}
              {intg.features.length > 3 && <span className={styles.featurePill}>+{intg.features.length - 3}</span>}
            </div>
            {intg.lastSync && (
              <div className={styles.intMeta}>
                <span className="material-icons-round" style={{ fontSize: 13 }}>sync</span>
                {new Date(intg.lastSync).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                {intg.recordsSynced !== undefined && <span className={styles.recordCount}>· {intg.recordsSynced.toLocaleString()} записей</span>}
              </div>
            )}
            <div className={styles.intActions} onClick={e => e.stopPropagation()}>
              {intg.status === 'connected' ? (
                <button className={styles.disconnectBtn} onClick={() => disconnect(intg.id)}>
                  <span className="material-icons-round">link_off</span> Отключить
                </button>
              ) : (
                <button className={styles.connectBtn} onClick={() => connect(intg.id)} disabled={connecting === intg.id}>
                  {connecting === intg.id ? <span className={styles.spinner} /> : <span className="material-icons-round">cable</span>}
                  {intg.status === 'error' ? 'Переподключить' : 'Подключить'}
                </button>
              )}
              <button className={styles.configBtn} onClick={() => setSelected(intg)}>
                <span className="material-icons-round">settings</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Integration detail */}
      {selected && (
        <div className={styles.overlay} onClick={() => setSelected(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div className={styles.modalTitle}>
                <span className="material-icons-round" style={{ color: STATUS_COLORS[selected.status] }}>{TYPE_ICONS[selected.type]}</span>
                {selected.name}
              </div>
              <button className={styles.closeBtn} onClick={() => setSelected(null)}><span className="material-icons-round">close</span></button>
            </div>
            <div className={styles.modalBody}>
              <p className={styles.intDesc}>{selected.description}</p>
              <div className={styles.statusRow}>
                <span className="material-icons-round" style={{ color: STATUS_COLORS[selected.status] }}>{STATUS_ICONS[selected.status]}</span>
                <span style={{ color: STATUS_COLORS[selected.status], fontWeight: 600 }}>{STATUS_LABELS[selected.status]}</span>
                {selected.lastSync && <span className={styles.syncTime}>· Синхр. {new Date(selected.lastSync).toLocaleString('ru-RU')}</span>}
              </div>

              {Object.keys(selected.config).length > 0 && (
                <div className={styles.configSection}>
                  <h4>Конфигурация</h4>
                  {Object.entries(selected.config).map(([k, v]) => (
                    <div key={k} className={styles.configRow}>
                      <span>{k}</span>
                      <code>{v}</code>
                    </div>
                  ))}
                </div>
              )}

              <div className={styles.featuresSection}>
                <h4>Возможности</h4>
                <div className={styles.featuresList}>
                  {selected.features.map(f => (
                    <div key={f} className={styles.featureItem}>
                      <span className="material-icons-round" style={{ color: '#34a853', fontSize: 16 }}>check_circle</span> {f}
                    </div>
                  ))}
                </div>
              </div>

              <div className={styles.modalActions}>
                <button className={styles.cancelBtn} onClick={() => setSelected(null)}>Закрыть</button>
                {selected.status === 'connected' ? (
                  <button className={styles.disconnectBtn} onClick={() => { disconnect(selected.id); setSelected(null) }}>
                    <span className="material-icons-round">link_off</span> Отключить
                  </button>
                ) : (
                  <button className={styles.saveBtn} onClick={() => { connect(selected.id); setSelected(null) }}>
                    <span className="material-icons-round">cable</span> Подключить
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* GeoJSON Import modal */}
      {showImport && (
        <div className={styles.overlay} onClick={() => setShowImport(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div className={styles.modalTitle}><span className="material-icons-round">upload_file</span> Импорт геоданных</div>
              <button className={styles.closeBtn} onClick={() => setShowImport(false)}><span className="material-icons-round">close</span></button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.dropZone}>
                <span className="material-icons-round">map</span>
                <p>Перетащите файл сюда или нажмите для выбора</p>
                <span className={styles.dropFormats}>.shp, .geojson, .kml, .kmz</span>
                <input type="file" accept=".shp,.geojson,.kml,.kmz" style={{ display: 'none' }} />
              </div>
              <div className={styles.formGroup}><label>Система координат</label>
                <select className={styles.select}><option>WGS84 (EPSG:4326)</option><option>СК-42 (EPSG:4284)</option><option>UTM Zone 37N</option></select>
              </div>
              <div className={styles.formGroup}><label>Сопоставление полей</label>
                <select className={styles.select}><option>Автоматически</option><option>Вручную</option></select>
              </div>
              <div className={styles.infoMsg}><span className="material-icons-round">info</span> Поля из файла будут добавлены к существующим. Дубликаты будут обнаружены автоматически.</div>
              <div className={styles.modalActions}>
                <button className={styles.cancelBtn} onClick={() => setShowImport(false)}>Отмена</button>
                <button className={styles.saveBtn} onClick={() => { alert('✅ Импорт запущен. Результаты будут доступны через несколько минут.'); setShowImport(false) }}>
                  <span className="material-icons-round">upload</span> Импортировать
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default IntegrationsPage
