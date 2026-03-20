import { WeatherData, WeatherSummary, WeatherForecast } from '../entities/WeatherData'

export interface IWeatherRepository {
  getCurrentByField(fieldId: string): Promise<WeatherData>
  getHistoricalByField(fieldId: string, from: string, to: string): Promise<WeatherData[]>
  getForecastByField(fieldId: string): Promise<WeatherForecast[]>
  getSummaryByField(fieldId: string): Promise<WeatherSummary>
}
