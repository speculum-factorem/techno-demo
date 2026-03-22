import apiClient from './ApiClient'
import { WeatherData, WeatherSummary, WeatherForecast } from '@domain/entities/WeatherData'

type WeatherSummaryApiDto = {
  fieldId: string
  avgTemperature: number
  totalPrecipitation: number
  avgHumidity: number
}

type WeatherForecastHourlyEntry = {
  time: string
  temperature: number
  humidity: number
  precipitation: number
  windSpeed: number
}

type WeatherForecastApiDto = {
  fieldId: string
  hourly: WeatherForecastHourlyEntry[]
}

const toIsoInstant = (dateYmd: string, endOfDay: boolean): string =>
  `${dateYmd}T${endOfDay ? '23:59:59' : '00:00:00'}Z`

const toDailyForecast = (hourly: WeatherForecastHourlyEntry[]): WeatherForecast[] => {
  const byDate: Record<string, WeatherForecastHourlyEntry[]> = {}
  hourly.forEach((entry) => {
    const date = entry.time.split('T')[0]
    byDate[date] = byDate[date] || []
    byDate[date].push(entry)
  })

  return Object.entries(byDate).slice(0, 7).map(([date, entries]) => {
    const temps = entries.map(e => e.temperature)
    const precipitations = entries.map(e => e.precipitation)
    const humidities = entries.map(e => e.humidity)
    const winds = entries.map(e => e.windSpeed)
    const wetHours = precipitations.filter(v => v > 0.2).length
    const precipitation = precipitations.reduce((sum, v) => sum + v, 0)

    return {
      date,
      tempMin: Math.min(...temps),
      tempMax: Math.max(...temps),
      precipitationProbability: (wetHours / Math.max(1, entries.length)) * 100,
      precipitation,
      humidity: humidities.reduce((sum, v) => sum + v, 0) / Math.max(1, humidities.length),
      windSpeed: winds.reduce((sum, v) => sum + v, 0) / Math.max(1, winds.length),
      weatherCode: precipitation > 10 ? 63 : precipitation > 0.5 ? 61 : 1,
      description: precipitation > 10 ? 'Дождь' : precipitation > 0.5 ? 'Небольшой дождь' : 'Переменная облачность',
    }
  })
}

export const weatherApi = {
  async getCurrentByField(fieldId: string): Promise<WeatherData> {
    const { data } = await apiClient.get<WeatherData>(`/weather/fields/${fieldId}/current`)
    return data
  },

  async getHistoricalByField(fieldId: string, from: string, to: string): Promise<WeatherData[]> {
    const { data } = await apiClient.get<WeatherData[]>(`/weather/fields/${fieldId}/historical`, {
      params: {
        start: toIsoInstant(from, false),
        end: toIsoInstant(to, true),
      },
    })
    return data
  },

  async getForecastByField(fieldId: string): Promise<WeatherForecast[]> {
    const { data } = await apiClient.get<WeatherForecastApiDto>(`/weather/fields/${fieldId}/forecast`)
    return toDailyForecast(data.hourly || [])
  },

  async getSummaryByField(fieldId: string): Promise<WeatherSummary> {
    const [currentResp, forecastResp, summaryResp] = await Promise.all([
      apiClient.get<WeatherData>(`/weather/fields/${fieldId}/current`),
      apiClient.get<WeatherForecastApiDto>(`/weather/fields/${fieldId}/forecast`),
      apiClient.get<WeatherSummaryApiDto>(`/weather/fields/${fieldId}/summary`),
    ])
    const forecast = toDailyForecast(forecastResp.data.hourly || [])
    return {
      current: currentResp.data,
      forecast,
      averageTemperature7d: summaryResp.data.avgTemperature ?? 0,
      totalPrecipitation7d: summaryResp.data.totalPrecipitation ?? 0,
      averageHumidity7d: summaryResp.data.avgHumidity ?? 0,
    }
  },
}
