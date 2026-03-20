import apiClient from './ApiClient'
import { USE_MOCK } from './config'
import { Alert } from '@domain/entities/Alert'
import { mockAlerts } from './MockData'

export const alertApi = {
  async getAll(): Promise<Alert[]> {
    if (USE_MOCK) {
      await new Promise(r => setTimeout(r, 400))
      return [...mockAlerts]
    }
    const { data } = await apiClient.get<Alert[]>('/alerts')
    return data
  },

  async markRead(id: string): Promise<void> {
    if (USE_MOCK) {
      const alert = mockAlerts.find(a => a.id === id)
      if (alert) alert.isRead = true
      return
    }
    await apiClient.patch(`/alerts/${id}/read`)
  },

  async markAllRead(): Promise<void> {
    if (USE_MOCK) {
      mockAlerts.forEach(a => { a.isRead = true })
      return
    }
    await apiClient.patch('/alerts/read-all')
  },
}
