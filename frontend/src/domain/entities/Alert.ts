export type AlertType = 'anomaly' | 'forecast' | 'irrigation' | 'system' | 'weather'
export type AlertSeverity = 'critical' | 'warning' | 'info'

export interface Alert {
  id: string
  type: AlertType
  severity: AlertSeverity
  title: string
  message: string
  fieldId?: string
  fieldName?: string
  isRead: boolean
  createdAt: string
  resolvedAt?: string
}
