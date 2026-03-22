import apiClient from './ApiClient'
import { Integration, IntegrationStatus, IntegrationType, SensorConnector, ConnectorProtocol, ConnectorStatus } from '@domain/entities/Integration'

type IntegrationApiDto = {
  id: string
  type: string
  name: string
  description: string
  icon: string
  status: string
  lastSync?: string | null
  recordsSynced?: number | null
  config: Record<string, string>
  features: string[]
}

type ConnectorApiDto = {
  id: string
  name: string
  protocol: string
  fieldId: string
  fieldName: string
  deviceName: string
  config: Record<string, any>
  status: string
  lastDataAt?: string | null
  lastError?: string | null
  recordsIngested: number
  createdAt: string
  webhookUrl?: string
}

const STATUSES: IntegrationStatus[] = ['connected', 'disconnected', 'error', 'pending']
const PROTOCOLS: ConnectorProtocol[] = ['http_poll', 'webhook', 'mqtt', 'modbus_tcp']
const CONN_STATUSES: ConnectorStatus[] = ['connected', 'disconnected', 'error']

function asStatus(s: string): IntegrationStatus {
  return STATUSES.includes(s as IntegrationStatus) ? (s as IntegrationStatus) : 'disconnected'
}
function asType(t: string): IntegrationType {
  const allowed: IntegrationType[] = ['1c_erp', 'weather_api', 'iot_gateway', 'geo_import', 'telegram', 'email_smtp']
  return (allowed.includes(t as IntegrationType) ? t : 'email_smtp') as IntegrationType
}
function asConnStatus(s: string): ConnectorStatus {
  return CONN_STATUSES.includes(s as ConnectorStatus) ? (s as ConnectorStatus) : 'disconnected'
}

export function integrationFromApi(d: IntegrationApiDto): Integration {
  return {
    id: d.id, type: asType(d.type), name: d.name, description: d.description, icon: d.icon,
    status: asStatus(d.status), lastSync: d.lastSync ?? undefined,
    recordsSynced: d.recordsSynced ?? undefined, config: d.config || {}, features: Array.isArray(d.features) ? d.features : [],
  }
}

function connectorFromApi(d: ConnectorApiDto): SensorConnector {
  return {
    id: d.id, name: d.name,
    protocol: (PROTOCOLS.includes(d.protocol as ConnectorProtocol) ? d.protocol : 'webhook') as ConnectorProtocol,
    fieldId: d.fieldId, fieldName: d.fieldName, deviceName: d.deviceName,
    config: d.config || {}, status: asConnStatus(d.status),
    lastDataAt: d.lastDataAt ?? undefined, lastError: d.lastError ?? undefined,
    recordsIngested: d.recordsIngested ?? 0, createdAt: d.createdAt,
    webhookUrl: d.webhookUrl || undefined,
  }
}

export const integrationsApi = {
  // System integrations
  async list(): Promise<Integration[]> {
    const { data } = await apiClient.get<IntegrationApiDto[]>('/analytics/integrations')
    return (data || []).map(integrationFromApi)
  },
  async connect(id: string): Promise<Integration> {
    const { data } = await apiClient.post<IntegrationApiDto>(`/analytics/integrations/${id}/connect`)
    return integrationFromApi(data)
  },
  async disconnect(id: string): Promise<Integration> {
    const { data } = await apiClient.post<IntegrationApiDto>(`/analytics/integrations/${id}/disconnect`)
    return integrationFromApi(data)
  },
  async updateConfig(id: string, config: Record<string, string>): Promise<Integration> {
    const { data } = await apiClient.put<IntegrationApiDto>(`/analytics/integrations/${id}/config`, { config })
    return integrationFromApi(data)
  },

  // Sensor connectors
  async listConnectors(): Promise<SensorConnector[]> {
    const { data } = await apiClient.get<ConnectorApiDto[]>('/analytics/sensors/connectors')
    return (data || []).map(connectorFromApi)
  },
  async createConnector(payload: {
    name: string; protocol: ConnectorProtocol; fieldId: string; fieldName?: string; deviceName?: string; config: Record<string, any>
  }): Promise<SensorConnector> {
    const { data } = await apiClient.post<ConnectorApiDto>('/analytics/sensors/connectors', payload)
    return connectorFromApi(data)
  },
  async updateConnector(id: string, payload: Partial<{
    name: string; protocol: ConnectorProtocol; fieldId: string; fieldName: string; deviceName: string; config: Record<string, any>
  }>): Promise<SensorConnector> {
    const { data } = await apiClient.put<ConnectorApiDto>(`/analytics/sensors/connectors/${encodeURIComponent(id)}`, payload)
    return connectorFromApi(data)
  },
  async deleteConnector(id: string): Promise<void> {
    await apiClient.delete(`/analytics/sensors/connectors/${encodeURIComponent(id)}`)
  },
  async testConnector(id: string): Promise<{ status: string; message: string; connector: SensorConnector }> {
    const { data } = await apiClient.post<{ status: string; message: string; connector: ConnectorApiDto }>(
      `/analytics/sensors/connectors/${encodeURIComponent(id)}/test`
    )
    return { status: data.status, message: data.message, connector: connectorFromApi(data.connector) }
  },
}
