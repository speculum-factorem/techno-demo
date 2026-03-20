import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import { Alert } from '@domain/entities/Alert'
import { alertApi } from '@infrastructure/api/AlertApi'

interface AlertsState {
  items: Alert[]
  unreadCount: number
  loading: boolean
  error: string | null
}

const initialState: AlertsState = {
  items: [],
  unreadCount: 0,
  loading: false,
  error: null,
}

export const fetchAlerts = createAsyncThunk('alerts/fetchAll', async (_, { rejectWithValue }) => {
  try {
    return await alertApi.getAll()
  } catch (err: any) {
    return rejectWithValue(err.response?.data?.message || 'Ошибка загрузки уведомлений')
  }
})

export const markAlertRead = createAsyncThunk(
  'alerts/markRead',
  async (id: string, { rejectWithValue }) => {
    try {
      await alertApi.markRead(id)
      return id
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Ошибка')
    }
  }
)

export const markAllRead = createAsyncThunk('alerts/markAllRead', async (_, { rejectWithValue }) => {
  try {
    await alertApi.markAllRead()
  } catch (err: any) {
    return rejectWithValue(err.response?.data?.message || 'Ошибка')
  }
})

const alertsSlice = createSlice({
  name: 'alerts',
  initialState,
  reducers: {
    clearError(state) { state.error = null },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchAlerts.pending, (state) => { state.loading = true })
      .addCase(fetchAlerts.fulfilled, (state, action) => {
        state.loading = false
        state.items = action.payload
        state.unreadCount = action.payload.filter((a: Alert) => !a.isRead).length
      })
      .addCase(fetchAlerts.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload as string
      })
      .addCase(markAlertRead.fulfilled, (state, action) => {
        const alert = state.items.find(a => a.id === action.payload)
        if (alert && !alert.isRead) {
          alert.isRead = true
          state.unreadCount = Math.max(0, state.unreadCount - 1)
        }
      })
      .addCase(markAllRead.fulfilled, (state) => {
        state.items.forEach(a => { a.isRead = true })
        state.unreadCount = 0
      })
  },
})

export const { clearError } = alertsSlice.actions
export default alertsSlice.reducer
