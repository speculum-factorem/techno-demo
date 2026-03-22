import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import { YieldForecast, HistoricalYield, ForecastRequest } from '@domain/entities/Forecast'
import { analyticsApi } from '@infrastructure/api/AnalyticsApi'

interface ForecastState {
  forecasts: Record<string, YieldForecast[]>
  historicalYields: Record<string, HistoricalYield[]>
  currentForecast: YieldForecast | null
  loading: boolean
  error: string | null
}

const initialState: ForecastState = {
  forecasts: {},
  historicalYields: {},
  currentForecast: null,
  loading: false,
  error: null,
}

export const fetchYieldForecast = createAsyncThunk(
  'forecast/fetchYield',
  async (request: ForecastRequest, { rejectWithValue }) => {
    try {
      return await analyticsApi.getYieldForecast(request)
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Ошибка получения прогноза урожайности')
    }
  }
)

export const fetchYieldForecastsByField = createAsyncThunk(
  'forecast/fetchByField',
  async (fieldId: string, { rejectWithValue }) => {
    try {
      const data = await analyticsApi.getYieldForecastsByField(fieldId)
      return { fieldId, data }
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Ошибка загрузки прогнозов')
    }
  }
)

export const fetchHistoricalYield = createAsyncThunk(
  'forecast/fetchHistorical',
  async (fieldId: string, { rejectWithValue }) => {
    try {
      const data = await analyticsApi.getHistoricalYield(fieldId)
      return { fieldId, data }
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Ошибка загрузки исторических урожаев')
    }
  }
)

const forecastSlice = createSlice({
  name: 'forecast',
  initialState,
  reducers: {
    clearError(state) { state.error = null },
    clearCurrentForecast(state) { state.currentForecast = null },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchYieldForecast.pending, (state) => { state.loading = true; state.error = null })
      .addCase(fetchYieldForecast.fulfilled, (state, action) => {
        state.loading = false
        state.currentForecast = action.payload
      })
      .addCase(fetchYieldForecast.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload as string
      })
      .addCase(fetchYieldForecastsByField.pending, (state) => { state.loading = true; state.error = null })
      .addCase(fetchYieldForecastsByField.fulfilled, (state, action) => {
        state.loading = false
        state.forecasts[action.payload.fieldId] = action.payload.data
      })
      .addCase(fetchYieldForecastsByField.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload as string
      })
      .addCase(fetchHistoricalYield.pending, (state) => { state.loading = true; state.error = null })
      .addCase(fetchHistoricalYield.fulfilled, (state, action) => {
        state.loading = false
        state.historicalYields[action.payload.fieldId] = action.payload.data
      })
      .addCase(fetchHistoricalYield.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload as string
      })
  },
})

export const { clearError, clearCurrentForecast } = forecastSlice.actions
export default forecastSlice.reducer
