import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Provider } from 'react-redux'
import { store } from '@application/store'
import MainLayout from '@presentation/components/layout/MainLayout/MainLayout'
import LoginPage from '@presentation/pages/Auth/LoginPage'
import Dashboard from '@presentation/pages/Dashboard/Dashboard'
import FieldsPage from '@presentation/pages/Fields/FieldsPage'
import ForecastPage from '@presentation/pages/Forecast/ForecastPage'
import IrrigationPage from '@presentation/pages/Irrigation/IrrigationPage'
import WeatherPage from '@presentation/pages/Weather/WeatherPage'
import AlertsPage from '@presentation/pages/Alerts/AlertsPage'
import '@presentation/styles/global.scss'

const PrivateRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const tokens = localStorage.getItem('tokens')
  return tokens ? <>{children}</> : <Navigate to="/auth/login" replace />
}

const App: React.FC = () => {
  return (
    <Provider store={store}>
      <BrowserRouter>
        <Routes>
          <Route path="/auth/login" element={<LoginPage />} />
          <Route
            path="/"
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
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </Provider>
  )
}

export default App
