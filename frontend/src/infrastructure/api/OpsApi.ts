import apiClient from './ApiClient'
import { WorkTask } from '@domain/entities/WorkTask'
import { Device } from '@domain/entities/Equipment'
import { AuditEntry } from '@domain/entities/AuditLog'
import { NotificationRule } from '@domain/entities/NotificationRule'

export type ReportHistoryItem = {
  id: string
  name: string
  format: 'pdf' | 'excel'
  date: string
  size: string
  user: string
}

export const opsApi = {
  getWorkTasks: async () => (await apiClient.get<WorkTask[]>('/analytics/ops/work-tasks')).data,
  createWorkTask: async (payload: Partial<WorkTask>) => (await apiClient.post<{ id: string }>('/analytics/ops/work-tasks', payload)).data,
  updateWorkTask: async (id: string, payload: Partial<WorkTask>) => (await apiClient.put('/analytics/ops/work-tasks/' + id, payload)).data,

  getEquipment: async () => (await apiClient.get<Device[]>('/analytics/ops/equipment')).data,
  getAuditLog: async () => (await apiClient.get<AuditEntry[]>('/analytics/ops/audit-log')).data,

  getRules: async () => (await apiClient.get<NotificationRule[]>('/analytics/ops/notification-rules')).data,
  createRule: async (payload: Partial<NotificationRule>) => (await apiClient.post<{ id: string }>('/analytics/ops/notification-rules', payload)).data,
  updateRule: async (id: string, payload: Partial<NotificationRule>) => (await apiClient.put('/analytics/ops/notification-rules/' + id, payload)).data,
  deleteRule: async (id: string) => (await apiClient.delete('/analytics/ops/notification-rules/' + id)).data,

  getReportsHistory: async () => (await apiClient.get<ReportHistoryItem[]>('/analytics/ops/reports/history')).data,
  generateReport: async (name: string, format: 'pdf' | 'excel') => (
    await apiClient.post<{ id: string; status: string }>('/analytics/ops/reports/generate', { name, format })
  ).data,

  ingestTelemetry: async (payload: {
    fieldId: string
    fieldName?: string
    deviceId?: string
    temperature?: number
    humidity?: number
    soilMoisture?: number
    precipitation?: number
    windSpeed?: number
    solarRadiation?: number
    lat?: number
    lng?: number
  }) => (await apiClient.post('/analytics/iot/telemetry', payload)).data,
}

