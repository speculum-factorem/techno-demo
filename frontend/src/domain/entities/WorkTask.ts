export type TaskStatus = 'todo' | 'in_progress' | 'done' | 'overdue'
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical'
export type TaskCategory = 'irrigation' | 'fertilization' | 'harvesting' | 'inspection' | 'maintenance' | 'other'

export interface ChecklistItem {
  id: string
  text: string
  done: boolean
}

export interface WorkTask {
  id: string
  title: string
  description: string
  category: TaskCategory
  priority: TaskPriority
  status: TaskStatus
  fieldId: string
  fieldName: string
  assignee: string
  assigneeRole: 'agronomist' | 'operator' | 'manager'
  deadline: string
  createdAt: string
  updatedAt: string
  checklist: ChecklistItem[]
  estimatedHours: number
  actualHours?: number
  notes?: string
}
