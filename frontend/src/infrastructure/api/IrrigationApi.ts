import apiClient from './ApiClient'
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
    const { data } = await apiClient.get<IrrigationTaskApiDto[]>(`/irrigation/fields/${fieldId}/tasks`)
    return data.map(toTask)
  },

  /** Update task status: 'scheduled' | 'active' | 'completed' | 'cancelled' | 'skipped' */
  async updateTaskStatus(taskId: string, status: IrrigationStatus): Promise<IrrigationTask> {
    const { data } = await apiClient.patch<IrrigationTaskApiDto>(
      `/irrigation/tasks/${taskId}/status?status=${status}`
    )
    return toTask(data)
  },
}
