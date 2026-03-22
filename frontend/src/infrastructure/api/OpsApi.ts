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

export type ScheduledReport = {
  id: string
  templateId: string
  name: string
  frequency: 'weekly' | 'monthly'
  nextRun: string
  recipients: string[]
  format: 'pdf' | 'excel'
  /** С сервера может прийти legacy «telegram» — в UI показываем как email-only. */
  channel: 'email' | string
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
  generateReport: async (name: string, format: 'pdf' | 'excel', templateId?: string) => (
    await apiClient.post<{ id: string; status: string }>('/analytics/ops/reports/generate', {
      name,
      format,
      templateId: templateId ?? '',
    })
  ).data,

  getScheduledReports: async () => (await apiClient.get<ScheduledReport[]>('/analytics/ops/reports/scheduled')).data,

  createScheduledReport: async (payload: {
    templateId: string
    name: string
    frequency: 'weekly' | 'monthly'
    format: 'pdf' | 'excel'
    channel: 'email'
    recipients: string[]
  }) => (await apiClient.post<ScheduledReport>('/analytics/ops/reports/scheduled', payload)).data,

  updateScheduledReport: async (
    id: string,
    payload: Partial<{
      templateId: string
      name: string
      frequency: 'weekly' | 'monthly'
      format: 'pdf' | 'excel'
      channel: 'email'
      recipients: string[]
    }>
  ) => (await apiClient.patch<ScheduledReport>(`/analytics/ops/reports/scheduled/${encodeURIComponent(id)}`, payload)).data,

  deleteScheduledReport: async (id: string) =>
    (await apiClient.delete(`/analytics/ops/reports/scheduled/${encodeURIComponent(id)}`)).data,

  /** Скачивает PDF или XLSX, сформированный на сервере. */
  downloadReportHistoryFile: async (reportId: string) => {
    const res = await apiClient.get<Blob>(`/analytics/ops/reports/history/${encodeURIComponent(reportId)}/download`, {
      responseType: 'blob',
    })
    const blob = res.data
    const cd = String(res.headers['content-disposition'] ?? '')
    let filename = `${reportId}.txt`
    const m = /filename="([^"]+)"/.exec(cd) || /filename=([^;\n]+)/.exec(cd)
    if (m) filename = m[1].trim().replace(/^"|"$/g, '')
    const url = URL.createObjectURL(blob)
    try {
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.rel = 'noopener'
      a.click()
    } finally {
      URL.revokeObjectURL(url)
    }
  },

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

