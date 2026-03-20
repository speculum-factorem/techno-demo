export type DeviceStatus = 'online' | 'offline' | 'warning' | 'error'
export type DeviceType = 'soil_sensor' | 'weather_station' | 'irrigation_controller' | 'drone' | 'tractor' | 'camera'

export interface Device {
  id: string
  name: string
  type: DeviceType
  fieldId: string
  fieldName: string
  status: DeviceStatus
  battery: number
  signal: number
  lastPing: string
  firmware: string
  installDate: string
  telemetry: {
    temperature?: number
    humidity?: number
    soilMoisture?: number
    pressure?: number
    windSpeed?: number
    lat: number
    lng: number
  }
  sla: {
    uptime: number
    dataQuality: number
    missedReadings: number
  }
  alerts: string[]
}
