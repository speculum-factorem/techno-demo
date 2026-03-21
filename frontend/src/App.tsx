import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Provider } from 'react-redux'
import { store } from '@application/store'
import { useAppDispatch, useAppSelector } from '@application/store/hooks'
import { initializeAuth } from '@application/store/slices/authSlice'
import MainLayout from '@presentation/components/layout/MainLayout/MainLayout'
import LandingPage from '@presentation/pages/Landing/LandingPage'
import ServiceInfoPage from '@presentation/pages/Landing/ServiceInfoPage'
import AppInfoPage from '@presentation/pages/Landing/AppInfoPage'
import DocumentationPage from '@presentation/pages/Landing/DocumentationPage'
import LoginPage from '@presentation/pages/Auth/LoginPage'
import RegisterPage from '@presentation/pages/Auth/RegisterPage'
import VerifyEmailPage from '@presentation/pages/Auth/VerifyEmailPage'
import ForgotPasswordPage from '@presentation/pages/Auth/ForgotPasswordPage'
import ResetPasswordPage from '@presentation/pages/Auth/ResetPasswordPage'
import Dashboard from '@presentation/pages/Dashboard/Dashboard'
import FieldsPage from '@presentation/pages/Fields/FieldsPage'
import ForecastPage from '@presentation/pages/Forecast/ForecastPage'
import IrrigationPage from '@presentation/pages/Irrigation/IrrigationPage'
import WeatherPage from '@presentation/pages/Weather/WeatherPage'
import AlertsPage from '@presentation/pages/Alerts/AlertsPage'
import ModelMetricsPage from '@presentation/pages/ModelMetrics/ModelMetricsPage'
import FieldInsightsPage from '@presentation/pages/FieldInsights/FieldInsightsPage'
import ScenarioPlannerPage from '@presentation/pages/ScenarioPlanner/ScenarioPlannerPage'
import WorkPlannerPage from '@presentation/pages/WorkPlanner/WorkPlannerPage'
import SatelliteAnalyticsPage from '@presentation/pages/SatelliteAnalytics/SatelliteAnalyticsPage'
import EquipmentPage from '@presentation/pages/EquipmentMonitor/EquipmentPage'
import AuditLogPage from '@presentation/pages/AuditLog/AuditLogPage'
import NotificationRulesPage from '@presentation/pages/NotificationRules/NotificationRulesPage'
import ReportsPage from '@presentation/pages/Reports/ReportsPage'
import RbacManagementPage from '@presentation/pages/RbacManagement/RbacManagementPage'
import IntegrationsPage from '@presentation/pages/Integrations/IntegrationsPage'
import PrivacyPolicyPage from '@presentation/pages/Legal/PrivacyPolicyPage'
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
        <Route path="/about-service" element={<ServiceInfoPage />} />
        <Route path="/about-app" element={<AppInfoPage />} />
        <Route path="/docs" element={<DocumentationPage />} />
        <Route path="/auth/login" element={<LoginPage />} />
        <Route path="/auth/register" element={<RegisterPage />} />
        <Route path="/auth/verify-email" element={<VerifyEmailPage />} />
        <Route path="/auth/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/auth/reset-password" element={<ResetPasswordPage />} />
        <Route path="/privacy" element={<PrivacyPolicyPage />} />
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
          {/* New modules */}
          <Route path="work-planner" element={<WorkPlannerPage />} />
          <Route path="satellite" element={<SatelliteAnalyticsPage />} />
          <Route path="equipment" element={<EquipmentPage />} />
          <Route path="audit" element={<AuditLogPage />} />
          <Route path="notification-rules" element={<NotificationRulesPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="rbac" element={<RbacManagementPage />} />
          <Route path="integrations" element={<IntegrationsPage />} />
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
