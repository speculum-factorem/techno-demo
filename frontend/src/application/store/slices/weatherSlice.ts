import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import { WeatherData, WeatherSummary, WeatherForecast } from '@domain/entities/WeatherData'
import { weatherApi } from '@infrastructure/api/WeatherApi'

interface WeatherState {
  summaries: Record<string, WeatherSummary>
  historical: Record<string, WeatherData[]>
  forecasts: Record<string, WeatherForecast[]>
  loading: boolean
  error: string | null
}

const initialState: WeatherState = {
  summaries: {},
  historical: {},
  forecasts: {},
  loading: false,
  error: null,
}

export const fetchWeatherSummary = createAsyncThunk(
  'weather/fetchSummary',
  async (fieldId: string, { rejectWithValue }) => {
    try {
      const data = await weatherApi.getSummaryByField(fieldId)
      return { fieldId, data }
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Ошибка загрузки погоды')
    }
  }
)

export const fetchHistoricalWeather = createAsyncThunk(
  'weather/fetchHistorical',
  async ({ fieldId, from, to }: { fieldId: string; from: string; to: string }, { rejectWithValue }) => {
    try {
      const data = await weatherApi.getHistoricalByField(fieldId, from, to)
      return { fieldId, data }
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Ошибка загрузки исторических данных')
    }
  }
)

export const fetchWeatherForecast = createAsyncThunk(
  'weather/fetchForecast',
  async (fieldId: string, { rejectWithValue }) => {
    try {
      const data = await weatherApi.getForecastByField(fieldId)
      return { fieldId, data }
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Ошибка загрузки прогноза погоды')
    }
  }
)

const weatherSlice = createSlice({
  name: 'weather',
  initialState,
  reducers: {
    clearError(state) { state.error = null },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchWeatherSummary.pending, (state) => { state.loading = true })
      .addCase(fetchWeatherSummary.fulfilled, (state, action) => {
        state.loading = false
        state.summaries[action.payload.fieldId] = action.payload.data
      })
      .addCase(fetchWeatherSummary.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload as string
      })
      .addCase(fetchHistoricalWeather.fulfilled, (state, action) => {
        state.historical[action.payload.fieldId] = action.payload.data
      })
      .addCase(fetchWeatherForecast.fulfilled, (state, action) => {
        state.forecasts[action.payload.fieldId] = action.payload.data
      })
  },
})

export const { clearError } = weatherSlice.actions
export default weatherSlice.reducer
