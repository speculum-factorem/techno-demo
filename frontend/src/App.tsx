import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Provider } from 'react-redux'
import { store } from '@application/store'
import { useAppDispatch, useAppSelector } from '@application/store/hooks'
import { initializeAuth } from '@application/store/slices/authSlice'
import MainLayout from '@presentation/components/layout/MainLayout/MainLayout'
import LandingPage from '@presentation/pages/Landing/LandingPage'
import LoginPage from '@presentation/pages/Auth/LoginPage'
import RegisterPage from '@presentation/pages/Auth/RegisterPage'
import VerifyEmailPage from '@presentation/pages/Auth/VerifyEmailPage'
import Dashboard from '@presentation/pages/Dashboard/Dashboard'
import FieldsPage from '@presentation/pages/Fields/FieldsPage'
import ForecastPage from '@presentation/pages/Forecast/ForecastPage'
import IrrigationPage from '@presentation/pages/Irrigation/IrrigationPage'
import WeatherPage from '@presentation/pages/Weather/WeatherPage'
import AlertsPage from '@presentation/pages/Alerts/AlertsPage'
import ModelMetricsPage from '@presentation/pages/ModelMetrics/ModelMetricsPage'
import FieldInsightsPage from '@presentation/pages/FieldInsights/FieldInsightsPage'
import ScenarioPlannerPage from '@presentation/pages/ScenarioPlanner/ScenarioPlannerPage'
import '@presentation/styles/global.scss'

const PrivateRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, initialized } = useAppSelector(s => s.auth)
  if (!initialized) return null
  return isAuthenticated ? <>{children}</> : <Navigate to="/auth/login" replace />
}

const AppRoutes: React.FC = () => {
  const dispatch = useAppDispatch()

  React.useEffect(() => {
    dispatch(initializeAuth())
  }, [dispatch])

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/auth/login" element={<LoginPage />} />
        <Route path="/auth/register" element={<RegisterPage />} />
        <Route path="/auth/verify-email" element={<VerifyEmailPage />} />
        <Route
          path="/app"
          element={
            <PrivateRoute>
              <MainLayout />
            </PrivateRoute>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="fields" element={<FieldsPage />} />
          <Route path="forecast" element={<ForecastPage />} />
          <Route path="irrigation" element={<IrrigationPage />} />
          <Route path="weather" element={<WeatherPage />} />
          <Route path="alerts" element={<AlertsPage />} />
          <Route path="model-metrics" element={<ModelMetricsPage />} />
          <Route path="field-insights" element={<FieldInsightsPage />} />
          <Route path="scenario-planner" element={<ScenarioPlannerPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

const App: React.FC = () => {
  return (
    <Provider store={store}>
      <AppRoutes />
    </Provider>
  )
}

export default App
