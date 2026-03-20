export type RuleOperator = 'lt' | 'gt' | 'lte' | 'gte' | 'eq'
export type RuleChannel = 'app' | 'email' | 'telegram'
export type RuleConditionField = 'soilMoisture' | 'temperature' | 'humidity' | 'rainfall' | 'windSpeed' | 'ndvi'

export interface RuleCondition {
  field: RuleConditionField
  operator: RuleOperator
  value: number
  unit: string
}

export interface NotificationRule {
  id: string
  name: string
  description: string
  enabled: boolean
  conditions: RuleCondition[]
  conditionLogic: 'AND' | 'OR'
  channels: RuleChannel[]
  recipients: string[]
  fieldIds: string[]
  cooldownMinutes: number
  createdBy: string
  createdAt: string
  lastTriggered?: string
  triggerCount: number
}
