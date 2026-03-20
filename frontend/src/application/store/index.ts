import { configureStore } from '@reduxjs/toolkit'
import authReducer from './slices/authSlice'
import fieldsReducer from './slices/fieldsSlice'
import weatherReducer from './slices/weatherSlice'
import forecastReducer from './slices/forecastSlice'
import irrigationReducer from './slices/irrigationSlice'
import alertsReducer from './slices/alertsSlice'
import anomalyReducer from './slices/anomalySlice'

export const store = configureStore({
  reducer: {
    auth: authReducer,
    fields: fieldsReducer,
    weather: weatherReducer,
    forecast: forecastReducer,
    irrigation: irrigationReducer,
    alerts: alertsReducer,
    anomaly: anomalyReducer,
  },
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
