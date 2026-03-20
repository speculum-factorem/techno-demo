export type AuditAction =
  | 'login' | 'logout'
  | 'field_update' | 'field_create' | 'field_delete'
  | 'recommendation_accept' | 'recommendation_reject'
  | 'forecast_run'
  | 'settings_change'
  | 'user_invite' | 'user_role_change' | 'user_delete'
  | 'alert_rule_create' | 'alert_rule_update' | 'alert_rule_delete'
  | 'export_pdf' | 'export_excel'
  | 'integration_connect' | 'integration_disconnect'

export interface AuditEntry {
  id: string
  timestamp: string
  userId: string
  userName: string
  userRole: string
  action: AuditAction
  entityType: string
  entityId: string
  entityName: string
  details: string
  ipAddress: string
  result: 'success' | 'failure'
}
