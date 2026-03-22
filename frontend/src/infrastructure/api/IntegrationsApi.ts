import apiClient from './ApiClient'
import { Integration, IntegrationStatus, IntegrationType } from '@domain/entities/Integration'

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

const STATUSES: IntegrationStatus[] = ['connected', 'disconnected', 'error', 'pending']

function asStatus(s: string): IntegrationStatus {
  return STATUSES.includes(s as IntegrationStatus) ? (s as IntegrationStatus) : 'disconnected'
}

function asType(t: string): IntegrationType {
  const allowed: IntegrationType[] = ['1c_erp', 'weather_api', 'iot_gateway', 'geo_import', 'telegram', 'email_smtp']
  return (allowed.includes(t as IntegrationType) ? t : 'email_smtp') as IntegrationType
}

export function integrationFromApi(d: IntegrationApiDto): Integration {
  return {
    id: d.id,
    type: asType(d.type),
    name: d.name,
    description: d.description,
    icon: d.icon,
    status: asStatus(d.status),
    lastSync: d.lastSync ?? undefined,
    recordsSynced: d.recordsSynced ?? undefined,
    config: d.config || {},
    features: Array.isArray(d.features) ? d.features : [],
  }
}

export const integrationsApi = {
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
}
