import apiClient from './ApiClient'
import { Alert } from '@domain/entities/Alert'

export const alertApi = {
  async getAll(): Promise<Alert[]> {
    const { data } = await apiClient.get<Alert[]>('/alerts')
    return data
  },

  async markRead(id: string): Promise<void> {
    await apiClient.patch(`/alerts/${id}/read`)
  },

  async markAllRead(): Promise<void> {
    await apiClient.patch('/alerts/read-all')
  },
}
