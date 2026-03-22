import React, { useCallback, useEffect, useState } from 'react'
import styles from './IntegrationsPage.module.scss'
import { Integration, IntegrationStatus, IntegrationType, SensorConnector, ConnectorProtocol } from '@domain/entities/Integration'
import { integrationsApi } from '@infrastructure/api/IntegrationsApi'
import { fieldApi } from '@infrastructure/api/FieldApi'
import { Field } from '@domain/entities/Field'

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

const PROTO_LABELS: Record<ConnectorProtocol, string> = {
  http_poll: 'HTTP Polling', webhook: 'Webhook Push', mqtt: 'MQTT', modbus_tcp: 'Modbus TCP',
}
const PROTO_ICONS: Record<ConnectorProtocol, string> = {
  http_poll: 'autorenew', webhook: 'webhook', mqtt: 'router', modbus_tcp: 'settings_ethernet',
}
const PROTO_COLORS: Record<ConnectorProtocol, string> = {
  http_poll: '#1a73e8', webhook: '#34a853', mqtt: '#f9ab00', modbus_tcp: '#ea4335',
}

// Config field definitions per integration type
const INTEGRATION_CONFIG_FIELDS: Record<IntegrationType, { key: string; label: string; type?: string; placeholder?: string }[]> = {
  '1c_erp': [
    { key: 'host', label: 'Хост / IP', placeholder: '192.168.1.100' },
    { key: 'port', label: 'Порт', placeholder: '8080' },
    { key: 'username', label: 'Имя пользователя', placeholder: 'admin' },
    { key: 'password', label: 'Пароль', type: 'password', placeholder: '••••••••' },
  ],
  email_smtp: [
    { key: 'host', label: 'SMTP хост', placeholder: 'smtp.gmail.com' },
    { key: 'port', label: 'SMTP порт', placeholder: '587' },
    { key: 'username', label: 'Имя пользователя', placeholder: 'user@example.com' },
    { key: 'password', label: 'Пароль / App token', type: 'password', placeholder: '••••••••' },
  ],
  telegram: [
    { key: 'bot_token', label: 'Bot Token', placeholder: '123456:ABC-DEF...' },
    { key: 'chat_id', label: 'Chat ID (необязательно)', placeholder: '-100123456789' },
  ],
  iot_gateway: [
    { key: 'endpoint_url', label: 'IoT Gateway URL (только чтение)', placeholder: 'http://gateway:8883' },
  ],
  weather_api: [
    { key: 'base_url', label: 'Open-Meteo URL (только чтение)', placeholder: 'https://api.open-meteo.com' },
  ],
  geo_import: [],
}

// Default connector form state
const EMPTY_CONN_FORM = {
  name: '',
  protocol: 'webhook' as ConnectorProtocol,
  fieldId: '',
  fieldName: '',
  deviceName: '',
  // http_poll
  url: '',
  interval_seconds: 60,
  auth_header: '',
  // mqtt
  broker_host: '',
  broker_port: 1883,
  mqtt_topic: '',
  mqtt_username: '',
  mqtt_password: '',
  // modbus_tcp
  modbus_host: '',
  modbus_port: 502,
  modbus_unit_id: 1,
  // field maps (shared)
  fm_temperature: '',
  fm_humidity: '',
  fm_soilMoisture: '',
  fm_precipitation: '',
  fm_windSpeed: '',
  fm_solarRadiation: '',
  fm_lat: '',
  fm_lng: '',
}

type ConnForm = typeof EMPTY_CONN_FORM

function connFormToPayload(form: ConnForm, fields: Field[]) {
  const field = fields.find(f => f.id === form.fieldId)
  const field_map: Record<string, string> = {}
  if (form.fm_temperature) field_map['temperature'] = form.fm_temperature
  if (form.fm_humidity) field_map['humidity'] = form.fm_humidity
  if (form.fm_soilMoisture) field_map['soilMoisture'] = form.fm_soilMoisture
  if (form.fm_precipitation) field_map['precipitation'] = form.fm_precipitation
  if (form.fm_windSpeed) field_map['windSpeed'] = form.fm_windSpeed
  if (form.fm_solarRadiation) field_map['solarRadiation'] = form.fm_solarRadiation
  if (form.fm_lat) field_map['lat'] = form.fm_lat
  if (form.fm_lng) field_map['lng'] = form.fm_lng

  let config: Record<string, any> = { field_map }

  if (form.protocol === 'http_poll') {
    config = { ...config, url: form.url, interval_seconds: form.interval_seconds, auth_header: form.auth_header }
  } else if (form.protocol === 'mqtt') {
    config = { ...config, broker_host: form.broker_host, broker_port: form.broker_port, topic: form.mqtt_topic, username: form.mqtt_username, password: form.mqtt_password }
  } else if (form.protocol === 'modbus_tcp') {
    config = { ...config, host: form.modbus_host, port: form.modbus_port, unit_id: form.modbus_unit_id }
  }

  return {
    name: form.name,
    protocol: form.protocol,
    fieldId: form.fieldId,
    fieldName: field?.name || form.fieldName,
    deviceName: form.deviceName,
    config,
  }
}

function connectorToForm(c: SensorConnector): ConnForm {
  const cfg = c.config || {}
  const fm = cfg.field_map || {}
  return {
    name: c.name,
    protocol: c.protocol,
    fieldId: c.fieldId,
    fieldName: c.fieldName,
    deviceName: c.deviceName,
    url: cfg.url || '',
    interval_seconds: cfg.interval_seconds || 60,
    auth_header: cfg.auth_header || '',
    broker_host: cfg.broker_host || '',
    broker_port: cfg.broker_port || 1883,
    mqtt_topic: cfg.topic || '',
    mqtt_username: cfg.username || '',
    mqtt_password: cfg.password || '',
    modbus_host: cfg.host || '',
    modbus_port: cfg.port || 502,
    modbus_unit_id: cfg.unit_id || 1,
    fm_temperature: fm.temperature || '',
    fm_humidity: fm.humidity || '',
    fm_soilMoisture: fm.soilMoisture || '',
    fm_precipitation: fm.precipitation || '',
    fm_windSpeed: fm.windSpeed || '',
    fm_solarRadiation: fm.solarRadiation || '',
    fm_lat: fm.lat || '',
    fm_lng: fm.lng || '',
  }
}

function getWebhookUrl(connector: SensorConnector): string {
  return `${window.location.origin}/api/analytics/sensors/webhook/${connector.id}`
}

const IntegrationsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'system' | 'sensors'>('system')

  // System integrations state
  const [integrations, setIntegrations] = useState<Integration[]>([])
  const [connecting, setConnecting] = useState<string | null>(null)
  const [loadingIntegrations, setLoadingIntegrations] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [showImport, setShowImport] = useState(false)
  const [configModal, setConfigModal] = useState<Integration | null>(null)
  const [configValues, setConfigValues] = useState<Record<string, string>>({})
  const [savingConfig, setSavingConfig] = useState(false)
  const [configSaveError, setConfigSaveError] = useState<string | null>(null)

  // Sensor connectors state
  const [connectors, setConnectors] = useState<SensorConnector[]>([])
  const [loadingConnectors, setLoadingConnectors] = useState(false)
  const [connectorError, setConnectorError] = useState<string | null>(null)
  const [fields, setFields] = useState<Field[]>([])
  const [showConnForm, setShowConnForm] = useState(false)
  const [editingConnector, setEditingConnector] = useState<SensorConnector | null>(null)
  const [connForm, setConnForm] = useState<ConnForm>({ ...EMPTY_CONN_FORM })
  const [savingConn, setSavingConn] = useState(false)
  const [connSaveError, setConnSaveError] = useState<string | null>(null)
  const [testingId, setTestingId] = useState<string | null>(null)
  const [testResults, setTestResults] = useState<Record<string, { status: string; message: string }>>({})
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const loadIntegrations = useCallback(async () => {
    setLoadingIntegrations(true)
    setLoadError(null)
    try {
      const list = await integrationsApi.list()
      setIntegrations(list)
    } catch (err) {
      setLoadError(apiErrorMessage(err, 'Не удалось загрузить интеграции'))
      setIntegrations([])
    } finally {
      setLoadingIntegrations(false)
    }
  }, [])

  const loadConnectors = useCallback(async () => {
    setLoadingConnectors(true)
    setConnectorError(null)
    try {
      const list = await integrationsApi.listConnectors()
      setConnectors(list)
    } catch (err) {
      setConnectorError(apiErrorMessage(err, 'Не удалось загрузить коннекторы'))
    } finally {
      setLoadingConnectors(false)
    }
  }, [])

  const loadFields = useCallback(async () => {
    try {
      const list = await fieldApi.getAll()
      setFields(list)
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    void loadIntegrations()
  }, [loadIntegrations])

  useEffect(() => {
    if (activeTab === 'sensors') {
      void loadConnectors()
      void loadFields()
    }
  }, [activeTab, loadConnectors, loadFields])

  const mergeUpdated = (updated: Integration) => {
    setIntegrations(prev => prev.map(i => (i.id === updated.id ? updated : i)))
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

  const openConfigModal = (intg: Integration) => {
    setConfigModal(intg)
    setConfigValues({ ...intg.config })
    setConfigSaveError(null)
  }

  const saveConfig = async () => {
    if (!configModal) return
    setSavingConfig(true)
    setConfigSaveError(null)
    try {
      const updated = await integrationsApi.updateConfig(configModal.id, configValues)
      mergeUpdated(updated)
      setConfigModal(null)
    } catch (err) {
      setConfigSaveError(apiErrorMessage(err, 'Не удалось сохранить конфигурацию'))
    } finally {
      setSavingConfig(false)
    }
  }

  const stats = {
    total: integrations.length,
    connected: integrations.filter(i => i.status === 'connected').length,
    errors: integrations.filter(i => i.status === 'error').length,
    records: integrations.reduce((s, i) => s + (i.recordsSynced || 0), 0),
  }

  // Connector actions
  const openAddConnector = () => {
    setEditingConnector(null)
    setConnForm({ ...EMPTY_CONN_FORM })
    setConnSaveError(null)
    setShowConnForm(true)
  }

  const openEditConnector = (c: SensorConnector) => {
    setEditingConnector(c)
    setConnForm(connectorToForm(c))
    setConnSaveError(null)
    setShowConnForm(true)
  }

  const saveConnector = async () => {
    setSavingConn(true)
    setConnSaveError(null)
    try {
      const payload = connFormToPayload(connForm, fields)
      if (editingConnector) {
        const updated = await integrationsApi.updateConnector(editingConnector.id, payload)
        setConnectors(prev => prev.map(c => c.id === updated.id ? updated : c))
      } else {
        const created = await integrationsApi.createConnector(payload)
        setConnectors(prev => [created, ...prev])
      }
      setShowConnForm(false)
    } catch (err) {
      setConnSaveError(apiErrorMessage(err, 'Не удалось сохранить коннектор'))
    } finally {
      setSavingConn(false)
    }
  }

  const testConnector = async (id: string) => {
    setTestingId(id)
    try {
      const result = await integrationsApi.testConnector(id)
      setTestResults(prev => ({ ...prev, [id]: { status: result.status, message: result.message } }))
      setConnectors(prev => prev.map(c => c.id === id ? result.connector : c))
    } catch (err) {
      const msg = apiErrorMessage(err, 'Ошибка тестирования')
      setTestResults(prev => ({ ...prev, [id]: { status: 'error', message: msg } }))
      // reload to get updated status
      void loadConnectors()
    } finally {
      setTestingId(null)
    }
  }

  const deleteConnector = async (id: string) => {
    if (!window.confirm('Удалить коннектор?')) return
    setDeletingId(id)
    try {
      await integrationsApi.deleteConnector(id)
      setConnectors(prev => prev.filter(c => c.id !== id))
    } catch (err) {
      setConnectorError(apiErrorMessage(err, 'Не удалось удалить коннектор'))
    } finally {
      setDeletingId(null)
    }
  }

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
    })
  }

  const setFormField = <K extends keyof ConnForm>(key: K, value: ConnForm[K]) => {
    setConnForm(prev => ({ ...prev, [key]: value }))
  }

  const connectorStats = {
    total: connectors.length,
    connected: connectors.filter(c => c.status === 'connected').length,
    errors: connectors.filter(c => c.status === 'error').length,
    records: connectors.reduce((s, c) => s + (c.recordsIngested || 0), 0),
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}><span className="material-icons-round">cable</span> Интеграции</h1>
          <p className={styles.sub}>1С/ERP, метеоAPI, IoT-шлюзы, GIS, Telegram, Email и датчики</p>
        </div>
        {activeTab === 'system' && (
          <button className={styles.importBtn} onClick={() => setShowImport(true)}>
            <span className="material-icons-round">upload_file</span> Импорт GeoJSON
          </button>
        )}
        {activeTab === 'sensors' && (
          <button className={styles.importBtn} onClick={openAddConnector}>
            <span className="material-icons-round">add</span> Добавить коннектор
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${activeTab === 'system' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('system')}
        >
          <span className="material-icons-round">hub</span> Системные интеграции
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'sensors' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('sensors')}
        >
          <span className="material-icons-round">sensors</span> Датчики и протоколы
        </button>
      </div>

      {/* ─── System integrations tab ─── */}
      {activeTab === 'system' && (
        <>
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

          {loadingIntegrations && <p className={styles.sub}>Загрузка…</p>}
          <div className={styles.intGrid}>
            {!loadingIntegrations && integrations.map(intg => (
              <div key={intg.id} className={`${styles.intCard} ${styles[`status_${intg.status}`]}`}>
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
                <div className={styles.intActions}>
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
                  <button className={styles.configBtn} onClick={() => openConfigModal(intg)}>
                    <span className="material-icons-round">settings</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ─── Sensors tab ─── */}
      {activeTab === 'sensors' && (
        <>
          {connectorError && (
            <div className={styles.infoMsg} style={{ marginBottom: 16, borderColor: '#ea4335', background: '#fce8e6' }}>
              <span className="material-icons-round" style={{ color: '#ea4335' }}>error_outline</span> {connectorError}
            </div>
          )}

          <div className={styles.statsRow}>
            {[
              { label: 'Коннекторов', value: connectorStats.total, icon: 'sensors', color: '#1a73e8' },
              { label: 'Активных', value: connectorStats.connected, icon: 'check_circle', color: '#34a853' },
              { label: 'Ошибок', value: connectorStats.errors, icon: 'error', color: '#ea4335' },
              { label: 'Записей принято', value: connectorStats.records.toLocaleString('ru-RU'), icon: 'storage', color: '#f9ab00' },
            ].map(s => (
              <div key={s.label} className={styles.statCard}>
                <span className="material-icons-round" style={{ color: s.color }}>{s.icon}</span>
                <strong style={{ color: s.color }}>{s.value}</strong>
                <span>{s.label}</span>
              </div>
            ))}
          </div>

          {loadingConnectors && <p className={styles.sub}>Загрузка…</p>}

          {!loadingConnectors && connectors.length === 0 && (
            <div className={styles.emptyState}>
              <span className="material-icons-round">sensors_off</span>
              <h3>Коннекторы не настроены</h3>
              <p>Добавьте коннектор датчика для получения данных через HTTP, Webhook, MQTT или Modbus TCP</p>
              <button className={styles.saveBtn} onClick={openAddConnector}>
                <span className="material-icons-round">add</span> Добавить коннектор
              </button>
            </div>
          )}

          {!loadingConnectors && connectors.length > 0 && (
            <div className={styles.connGrid}>
              {connectors.map(c => {
                const testResult = testResults[c.id]
                const webhookUrl = c.protocol === 'webhook' ? getWebhookUrl(c) : null
                return (
                  <div key={c.id} className={styles.connCard}>
                    <div className={styles.connCardHeader}>
                      <div className={styles.connProto} style={{ background: PROTO_COLORS[c.protocol] + '15', color: PROTO_COLORS[c.protocol] }}>
                        <span className="material-icons-round" style={{ fontSize: 14 }}>{PROTO_ICONS[c.protocol]}</span>
                        {PROTO_LABELS[c.protocol]}
                      </div>
                      <div className={styles.connStatus} style={{ color: c.status === 'connected' ? '#34a853' : c.status === 'error' ? '#ea4335' : '#9aa0a6' }}>
                        <span className="material-icons-round" style={{ fontSize: 14 }}>
                          {c.status === 'connected' ? 'check_circle' : c.status === 'error' ? 'error' : 'radio_button_unchecked'}
                        </span>
                        {c.status === 'connected' ? 'Активен' : c.status === 'error' ? 'Ошибка' : 'Отключён'}
                      </div>
                    </div>

                    <div className={styles.intName}>{c.name}</div>
                    {c.fieldName && (
                      <div className={styles.connField}>
                        <span className="material-icons-round" style={{ fontSize: 14 }}>landscape</span>
                        {c.fieldName}
                        {c.deviceName && <span className={styles.connDevice}>· {c.deviceName}</span>}
                      </div>
                    )}

                    <div className={styles.connMeta}>
                      {c.lastDataAt && (
                        <span>
                          <span className="material-icons-round" style={{ fontSize: 12 }}>schedule</span>
                          {new Date(c.lastDataAt).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                      {c.recordsIngested > 0 && (
                        <span>
                          <span className="material-icons-round" style={{ fontSize: 12 }}>storage</span>
                          {c.recordsIngested.toLocaleString()} зап.
                        </span>
                      )}
                    </div>

                    {c.lastError && (
                      <div className={styles.connError}>
                        <span className="material-icons-round" style={{ fontSize: 13 }}>error_outline</span>
                        {c.lastError}
                      </div>
                    )}

                    {webhookUrl && (
                      <div className={styles.webhookUrlBox}>
                        <span className={styles.webhookUrlText}>{webhookUrl}</span>
                        <button className={styles.copyBtn} onClick={() => copyToClipboard(webhookUrl, c.id)} title="Скопировать URL">
                          <span className="material-icons-round" style={{ fontSize: 16 }}>
                            {copiedId === c.id ? 'check' : 'content_copy'}
                          </span>
                        </button>
                      </div>
                    )}

                    {testResult && (
                      <div className={`${styles.testResult} ${testResult.status === 'connected' ? styles.testSuccess : styles.testError}`}>
                        <span className="material-icons-round" style={{ fontSize: 14 }}>
                          {testResult.status === 'connected' ? 'check_circle' : 'error'}
                        </span>
                        {testResult.message}
                      </div>
                    )}

                    <div className={styles.connActions}>
                      <button
                        className={styles.connectBtn}
                        style={{ fontSize: '0.8rem', padding: '7px 10px' }}
                        onClick={() => void testConnector(c.id)}
                        disabled={testingId === c.id}
                      >
                        {testingId === c.id ? <span className={styles.spinner} /> : <span className="material-icons-round" style={{ fontSize: 16 }}>network_check</span>}
                        Тест
                      </button>
                      <button
                        className={styles.configBtn}
                        onClick={() => openEditConnector(c)}
                        title="Редактировать"
                      >
                        <span className="material-icons-round" style={{ fontSize: 18 }}>edit</span>
                      </button>
                      <button
                        className={`${styles.configBtn} ${styles.dangerBtn}`}
                        onClick={() => void deleteConnector(c.id)}
                        disabled={deletingId === c.id}
                        title="Удалить"
                      >
                        <span className="material-icons-round" style={{ fontSize: 18 }}>delete</span>
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* ─── Config modal for system integrations ─── */}
      {configModal && (
        <div className={styles.overlay} onClick={() => setConfigModal(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div className={styles.modalTitle}>
                <span className="material-icons-round" style={{ color: STATUS_COLORS[configModal.status] }}>{TYPE_ICONS[configModal.type]}</span>
                Настройка: {configModal.name}
              </div>
              <button className={styles.closeBtn} onClick={() => setConfigModal(null)}><span className="material-icons-round">close</span></button>
            </div>
            <div className={styles.modalBody}>
              <p className={styles.intDesc}>{configModal.description}</p>

              <div className={styles.configForm}>
                {(INTEGRATION_CONFIG_FIELDS[configModal.type] || []).map(field => (
                  <div key={field.key} className={styles.formGroup}>
                    <label>{field.label}</label>
                    <input
                      type={field.type || 'text'}
                      className={styles.input}
                      placeholder={field.placeholder || ''}
                      value={configValues[field.key] || ''}
                      onChange={e => setConfigValues(prev => ({ ...prev, [field.key]: e.target.value }))}
                      readOnly={configModal.type === 'iot_gateway' || configModal.type === 'weather_api'}
                    />
                  </div>
                ))}
                {INTEGRATION_CONFIG_FIELDS[configModal.type]?.length === 0 && (
                  <div className={styles.infoMsg}>
                    <span className="material-icons-round">info</span>
                    Эта интеграция не требует дополнительной настройки.
                  </div>
                )}
              </div>

              {configSaveError && (
                <div className={styles.infoMsg} style={{ borderColor: '#ea4335', background: '#fce8e6' }}>
                  <span className="material-icons-round" style={{ color: '#ea4335' }}>error_outline</span> {configSaveError}
                </div>
              )}

              <div className={styles.statusRow}>
                <span className="material-icons-round" style={{ color: STATUS_COLORS[configModal.status] }}>{STATUS_ICONS[configModal.status]}</span>
                <span style={{ color: STATUS_COLORS[configModal.status], fontWeight: 600 }}>{STATUS_LABELS[configModal.status]}</span>
                {configModal.lastSync && <span className={styles.syncTime}>· Синхр. {new Date(configModal.lastSync).toLocaleString('ru-RU')}</span>}
              </div>

              <div className={styles.featuresSection}>
                <h4>Возможности</h4>
                <div className={styles.featuresList}>
                  {configModal.features.map(f => (
                    <div key={f} className={styles.featureItem}>
                      <span className="material-icons-round" style={{ color: '#34a853', fontSize: 16 }}>check_circle</span> {f}
                    </div>
                  ))}
                </div>
              </div>

              <div className={styles.modalActions}>
                <button className={styles.cancelBtn} onClick={() => setConfigModal(null)}>Отмена</button>
                <button className={styles.saveBtn} onClick={() => void saveConfig()} disabled={savingConfig}>
                  {savingConfig ? <span className={styles.spinner} /> : <span className="material-icons-round">save</span>}
                  Сохранить
                </button>
                {configModal.status === 'connected' ? (
                  <button className={styles.disconnectBtn} onClick={() => { void disconnect(configModal.id); setConfigModal(null) }}>
                    <span className="material-icons-round">link_off</span> Отключить
                  </button>
                ) : (
                  <button className={styles.connectBtn} style={{ flex: 'unset' }} onClick={() => { void connect(configModal.id) }} disabled={connecting === configModal.id}>
                    <span className="material-icons-round">cable</span>
                    {connecting === configModal.id ? 'Подключение…' : 'Подключить'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Add/Edit connector modal ─── */}
      {showConnForm && (
        <div className={styles.overlay} onClick={() => setShowConnForm(false)}>
          <div className={styles.modal} style={{ maxWidth: 620 }} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div className={styles.modalTitle}>
                <span className="material-icons-round">sensors</span>
                {editingConnector ? 'Редактировать коннектор' : 'Добавить коннектор'}
              </div>
              <button className={styles.closeBtn} onClick={() => setShowConnForm(false)}><span className="material-icons-round">close</span></button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.configForm}>
                <div className={styles.formGroup}>
                  <label>Название</label>
                  <input className={styles.input} placeholder="Мой датчик температуры" value={connForm.name} onChange={e => setFormField('name', e.target.value)} />
                </div>

                <div className={styles.formGroup}>
                  <label>Протокол</label>
                  <div className={styles.protoSelector}>
                    {(['http_poll', 'webhook', 'mqtt', 'modbus_tcp'] as ConnectorProtocol[]).map(p => (
                      <button
                        key={p}
                        className={`${styles.protoBadge} ${connForm.protocol === p ? styles.protoBadgeActive : ''}`}
                        style={connForm.protocol === p ? { background: PROTO_COLORS[p], color: '#fff' } : {}}
                        onClick={() => setFormField('protocol', p)}
                        type="button"
                      >
                        <span className="material-icons-round" style={{ fontSize: 14 }}>{PROTO_ICONS[p]}</span>
                        {PROTO_LABELS[p]}
                      </button>
                    ))}
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label>Поле / Участок</label>
                  <select className={styles.select} value={connForm.fieldId} onChange={e => setFormField('fieldId', e.target.value)}>
                    <option value="">— Выберите поле —</option>
                    {fields.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                </div>

                <div className={styles.formGroup}>
                  <label>Название устройства (метка, необязательно)</label>
                  <input className={styles.input} placeholder="Sensor-01, WeatherStation-North..." value={connForm.deviceName} onChange={e => setFormField('deviceName', e.target.value)} />
                </div>

                {/* HTTP Poll config */}
                {connForm.protocol === 'http_poll' && (
                  <div className={styles.configSection}>
                    <div className={styles.configSectionTitle}>
                      <span className="material-icons-round">autorenew</span> HTTP Polling
                    </div>
                    <div className={styles.formGroup}>
                      <label>URL эндпоинта датчика *</label>
                      <input className={styles.input} placeholder="https://sensor.example.com/api/data" value={connForm.url} onChange={e => setFormField('url', e.target.value)} />
                    </div>
                    <div className={styles.formGroup}>
                      <label>Интервал опроса: {connForm.interval_seconds} сек ({Math.round(connForm.interval_seconds / 60)} мин)</label>
                      <input
                        type="range" min={60} max={3600} step={60}
                        className={styles.rangeInput}
                        value={connForm.interval_seconds}
                        onChange={e => setFormField('interval_seconds', Number(e.target.value))}
                      />
                    </div>
                    <div className={styles.formGroup}>
                      <label>Auth Header (необязательно, например: Authorization: Bearer TOKEN)</label>
                      <input className={styles.input} placeholder="Authorization: Bearer eyJ..." value={connForm.auth_header} onChange={e => setFormField('auth_header', e.target.value)} />
                    </div>
                  </div>
                )}

                {/* Webhook config */}
                {connForm.protocol === 'webhook' && (
                  <div className={styles.configSection}>
                    <div className={styles.configSectionTitle}>
                      <span className="material-icons-round">webhook</span> Webhook Push
                    </div>
                    {editingConnector ? (
                      <div>
                        <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#5f6368' }}>Webhook URL (датчик отправляет POST на этот адрес)</label>
                        <div className={styles.webhookUrlBox} style={{ marginTop: 8 }}>
                          <span className={styles.webhookUrlText}>{getWebhookUrl(editingConnector)}</span>
                          <button className={styles.copyBtn} onClick={() => copyToClipboard(getWebhookUrl(editingConnector!), 'modal')} title="Скопировать">
                            <span className="material-icons-round" style={{ fontSize: 16 }}>{copiedId === 'modal' ? 'check' : 'content_copy'}</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className={styles.infoMsg}>
                        <span className="material-icons-round">info</span>
                        После создания коннектора здесь появится URL для настройки датчика.
                      </div>
                    )}
                  </div>
                )}

                {/* MQTT config */}
                {connForm.protocol === 'mqtt' && (
                  <div className={styles.configSection}>
                    <div className={styles.configSectionTitle}>
                      <span className="material-icons-round">router</span> MQTT
                    </div>
                    <div className={styles.formRow}>
                      <div className={styles.formGroup} style={{ flex: 2 }}>
                        <label>Хост брокера *</label>
                        <input className={styles.input} placeholder="mqtt.example.com" value={connForm.broker_host} onChange={e => setFormField('broker_host', e.target.value)} />
                      </div>
                      <div className={styles.formGroup} style={{ flex: 1 }}>
                        <label>Порт</label>
                        <input className={styles.input} type="number" value={connForm.broker_port} onChange={e => setFormField('broker_port', Number(e.target.value))} />
                      </div>
                    </div>
                    <div className={styles.formGroup}>
                      <label>Topic *</label>
                      <input className={styles.input} placeholder="sensors/field1/telemetry" value={connForm.mqtt_topic} onChange={e => setFormField('mqtt_topic', e.target.value)} />
                    </div>
                    <div className={styles.formRow}>
                      <div className={styles.formGroup} style={{ flex: 1 }}>
                        <label>Username (необязательно)</label>
                        <input className={styles.input} value={connForm.mqtt_username} onChange={e => setFormField('mqtt_username', e.target.value)} />
                      </div>
                      <div className={styles.formGroup} style={{ flex: 1 }}>
                        <label>Password (необязательно)</label>
                        <input className={styles.input} type="password" value={connForm.mqtt_password} onChange={e => setFormField('mqtt_password', e.target.value)} />
                      </div>
                    </div>
                  </div>
                )}

                {/* Modbus TCP config */}
                {connForm.protocol === 'modbus_tcp' && (
                  <div className={styles.configSection}>
                    <div className={styles.configSectionTitle}>
                      <span className="material-icons-round">settings_ethernet</span> Modbus TCP
                    </div>
                    <div className={styles.formRow}>
                      <div className={styles.formGroup} style={{ flex: 2 }}>
                        <label>IP адрес / Хост *</label>
                        <input className={styles.input} placeholder="192.168.1.50" value={connForm.modbus_host} onChange={e => setFormField('modbus_host', e.target.value)} />
                      </div>
                      <div className={styles.formGroup} style={{ flex: 1 }}>
                        <label>Порт</label>
                        <input className={styles.input} type="number" value={connForm.modbus_port} onChange={e => setFormField('modbus_port', Number(e.target.value))} />
                      </div>
                      <div className={styles.formGroup} style={{ flex: 1 }}>
                        <label>Unit ID</label>
                        <input className={styles.input} type="number" value={connForm.modbus_unit_id} onChange={e => setFormField('modbus_unit_id', Number(e.target.value))} />
                      </div>
                    </div>
                  </div>
                )}

                {/* Field mappings (shared for all protocols) */}
                <div className={styles.configSection}>
                  <div className={styles.configSectionTitle}>
                    <span className="material-icons-round">account_tree</span> Маппинг полей JSON
                    <span className={styles.configSectionHint}>(JSON path, например: data.temperature)</span>
                  </div>
                  <div className={styles.fieldMapGrid}>
                    {[
                      { key: 'fm_temperature', label: 'Температура (°C)' },
                      { key: 'fm_humidity', label: 'Влажность (%)' },
                      { key: 'fm_soilMoisture', label: 'Влажность почвы (%)' },
                      { key: 'fm_precipitation', label: 'Осадки (мм)' },
                      { key: 'fm_windSpeed', label: 'Скорость ветра (м/с)' },
                      { key: 'fm_solarRadiation', label: 'Солнечная радиация (Вт/м²)' },
                      { key: 'fm_lat', label: 'Широта' },
                      { key: 'fm_lng', label: 'Долгота' },
                    ].map(({ key, label }) => (
                      <div key={key} className={styles.formGroup}>
                        <label>{label}</label>
                        <input
                          className={styles.input}
                          placeholder="data.temp"
                          value={(connForm as any)[key]}
                          onChange={e => setFormField(key as keyof ConnForm, e.target.value as any)}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {connSaveError && (
                <div className={styles.infoMsg} style={{ borderColor: '#ea4335', background: '#fce8e6' }}>
                  <span className="material-icons-round" style={{ color: '#ea4335' }}>error_outline</span> {connSaveError}
                </div>
              )}

              <div className={styles.modalActions}>
                <button className={styles.cancelBtn} onClick={() => setShowConnForm(false)}>Отмена</button>
                <button className={styles.saveBtn} onClick={() => void saveConnector()} disabled={savingConn}>
                  {savingConn ? <span className={styles.spinner} /> : <span className="material-icons-round">save</span>}
                  {editingConnector ? 'Сохранить' : 'Создать'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── GeoJSON Import modal ─── */}
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
                <button className={styles.saveBtn} onClick={() => { alert('Импорт запущен. Результаты будут доступны через несколько минут.'); setShowImport(false) }}>
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
