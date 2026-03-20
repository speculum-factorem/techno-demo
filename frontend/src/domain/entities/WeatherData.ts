export interface WeatherData {
  id: string
  fieldId: string
  timestamp: string
  temperature: number // °C
  humidity: number // %
  precipitation: number // mm
  windSpeed: number // m/s
  windDirection: number // degrees
  pressure: number // hPa
  solarRadiation: number // W/m²
  soilMoisture?: number // %
  soilTemperature?: number // °C
  /** api = live forecast; open-meteo-archive = daily history from external archive */
  source: 'sensor' | 'station' | 'api' | 'open-meteo' | 'open-meteo-archive'
}

export interface WeatherForecast {
  date: string
  tempMin: number
  tempMax: number
  precipitationProbability: number
  precipitation: number
  humidity: number
  windSpeed: number
  weatherCode: number
  description: string
}

export interface WeatherSummary {
  current: WeatherData
  forecast: WeatherForecast[]
  averageTemperature7d: number
  totalPrecipitation7d: number
  averageHumidity7d: number
}
