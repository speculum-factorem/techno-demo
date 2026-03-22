export type IntegrationStatus = 'connected' | 'disconnected' | 'error' | 'pending'
export type IntegrationType = '1c_erp' | 'weather_api' | 'iot_gateway' | 'geo_import' | 'telegram' | 'email_smtp'

export interface Integration {
  id: string
  type: IntegrationType
  name: string
  description: string
  icon: string
  status: IntegrationStatus
  lastSync?: string
  recordsSynced?: number
  config: Record<string, string>
  features: string[]
  setupUrl?: string
}

export type ConnectorProtocol = 'http_poll' | 'webhook' | 'mqtt' | 'modbus_tcp'
export type ConnectorStatus = 'connected' | 'disconnected' | 'error'

export interface SensorConnector {
  id: string
  name: string
  protocol: ConnectorProtocol
  fieldId: string
  fieldName: string
  deviceName: string
  config: Record<string, any>
  status: ConnectorStatus
  lastDataAt?: string
  lastError?: string
  recordsIngested: number
  createdAt: string
  webhookUrl?: string
}
