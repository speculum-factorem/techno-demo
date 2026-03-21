import apiClient from './ApiClient'
import { USE_MOCK } from './config'
import { IrrigationTask, IrrigationStatus, IrrigationPriority } from '@domain/entities/Irrigation'

// Raw DTO shape as returned by Java irrigation-service
type IrrigationTaskApiDto = {
  id: string
  fieldId: string
  fieldName: string
  scheduledDate: string   // "2026-03-21"
  waterAmount: number
  duration: number
  priority: string        // "high" / "critical" etc.
  reason: string
  moistureDeficit: number
  confidence: number
  status: string          // "scheduled" / "active" / "completed" / "cancelled" / "skipped"
  createdAt: string
}

const normalizeStatus = (s?: string): IrrigationStatus => {
  const v = (s || '').toLowerCase()
  if (v === 'scheduled' || v === 'active' || v === 'completed' || v === 'cancelled' || v === 'skipped') return v
  return 'scheduled'
}

const normalizePriority = (p?: string): IrrigationPriority => {
  const v = (p || '').toLowerCase()
  if (v === 'critical' || v === 'high' || v === 'medium' || v === 'low') return v
  return 'medium'
}

const toTask = (dto: IrrigationTaskApiDto): IrrigationTask => ({
  id: String(dto.id),
  fieldId: String(dto.fieldId),
  fieldName: dto.fieldName || '',
  scheduledDate: dto.scheduledDate || '',
  waterAmount: dto.waterAmount ?? 0,
  duration: dto.duration ?? 0,
  priority: normalizePriority(dto.priority),
  reason: dto.reason || '',
  moistureDeficit: dto.moistureDeficit ?? 0,
  confidence: dto.confidence ?? 0,
  status: normalizeStatus(dto.status),
  createdAt: dto.createdAt || '',
})

export const irrigationApi = {
  /** Fetch irrigation tasks for a specific field from Java irrigation-service */
  async getTasksByField(fieldId: string): Promise<IrrigationTask[]> {
    if (USE_MOCK) {
      // In mock mode return empty list (tasks come from Kafka events in production)
      await new Promise(r => setTimeout(r, 200))
      return []
    }
    const { data } = await apiClient.get<IrrigationTaskApiDto[]>(`/irrigation/fields/${fieldId}/tasks`)
    return data.map(toTask)
  },

  /** Update task status: 'scheduled' | 'active' | 'completed' | 'cancelled' | 'skipped' */
  async updateTaskStatus(taskId: string, status: IrrigationStatus): Promise<IrrigationTask> {
    if (USE_MOCK) {
      await new Promise(r => setTimeout(r, 200))
      throw new Error('Mock mode: task status update not supported')
    }
    const { data } = await apiClient.patch<IrrigationTaskApiDto>(
      `/irrigation/tasks/${taskId}/status?status=${status}`
    )
    return toTask(data)
  },
}
