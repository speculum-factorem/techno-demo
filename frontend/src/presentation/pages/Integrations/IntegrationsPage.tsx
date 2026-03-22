import React, { useCallback, useEffect, useState } from 'react'
import styles from './IntegrationsPage.module.scss'
import { Integration, IntegrationStatus, IntegrationType } from '@domain/entities/Integration'
import { integrationsApi } from '@infrastructure/api/IntegrationsApi'

function apiErrorMessage(err: unknown, fallback: string): string {
  const e = err as { response?: { data?: Record<string, unknown> } }
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
  const [integrations, setIntegrations] = useState<Integration[]>([])
  const [selected, setSelected] = useState<Integration | null>(null)
  const [connecting, setConnecting] = useState<string | null>(null)
  const [showImport, setShowImport] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const loadList = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const list = await integrationsApi.list()
      setIntegrations(list)
    } catch (err) {
      setLoadError(apiErrorMessage(err, 'Не удалось загрузить интеграции'))
      setIntegrations([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadList()
  }, [loadList])

  const mergeUpdated = (updated: Integration) => {
    setIntegrations(prev => prev.map(i => (i.id === updated.id ? updated : i)))
    setSelected(s => (s?.id === updated.id ? updated : s))
  }

  const connect = async (id: string) => {
    setConnecting(id)
    setActionError(null)
    try {
      const updated = await integrationsApi.connect(id)
      mergeUpdated(updated)
    } catch (err) {
      setActionError(apiErrorMessage(err, 'Не удалось подключить'))
    } finally {
      setConnecting(null)
    }
  }

  const disconnect = async (id: string) => {
    setActionError(null)
    try {
      const updated = await integrationsApi.disconnect(id)
      mergeUpdated(updated)
    } catch (err) {
      setActionError(apiErrorMessage(err, 'Не удалось отключить'))
    }
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
      {loading && <p className={styles.sub}>Загрузка…</p>}
      <div className={styles.intGrid}>
        {!loading && integrations.map(intg => (
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
                <button className={styles.disconnectBtn} onClick={() => void disconnect(intg.id)}>
                  <span className="material-icons-round">link_off</span> Отключить
                </button>
              ) : (
                <button className={styles.connectBtn} onClick={() => void connect(intg.id)} disabled={connecting === intg.id}>
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
                  <button className={styles.disconnectBtn} onClick={() => { void disconnect(selected.id); setSelected(null) }}>
                    <span className="material-icons-round">link_off</span> Отключить
                  </button>
                ) : (
                  <button className={styles.saveBtn} onClick={() => { void connect(selected.id) }} disabled={connecting === selected.id}>
                    <span className="material-icons-round">cable</span> {connecting === selected.id ? 'Подключение…' : 'Подключить'}
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
