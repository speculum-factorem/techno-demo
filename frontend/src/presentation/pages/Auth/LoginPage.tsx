import React, { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAppDispatch, useAppSelector } from '@application/store/hooks'
import { login, clearError, verifyLoginCode, clearLoginChallenge, setLoginChallenge } from '@application/store/slices/authSlice'
import Button from '@presentation/components/common/Button/Button'
import Input from '@presentation/components/common/Input/Input'
import Alert from '@presentation/components/common/Alert/Alert'
import { authApi } from '@infrastructure/api/AuthApi'
import EmailCodeModal from './EmailCodeModal'
import styles from './AuthPage.module.scss'

const demoAccounts = [
  { label: 'Администратор', username: 'admin', password: 'admin', icon: 'admin_panel_settings', color: '#1a73e8' },
  { label: 'Агроном', username: 'agronomist', password: 'agronomist', icon: 'grass', color: '#34a853' },
]
const LoginPage: React.FC = () => {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const location = useLocation()
  const {
    loading,
    error,
    isAuthenticated,
    loginRequestId,
    loginChallengeMessage,
    loginChallengeExpiresInSeconds,
  } = useAppSelector(s => s.auth)

  const locationState = location.state as { registeredMessage?: string; prefillUsername?: string; prefillPassword?: string } | null
  const registeredMessage = locationState?.registeredMessage

  const [username, setUsername] = useState(locationState?.prefillUsername || '')
  const [password, setPassword] = useState(locationState?.prefillPassword || '')
  const [codeModalOpen, setCodeModalOpen] = useState(false)
  const [codeError, setCodeError] = useState('')
  const [resendError, setResendError] = useState('')
  const [resendLoading, setResendLoading] = useState(false)
  const [validationError, setValidationError] = useState('')

  useEffect(() => {
    if (isAuthenticated) navigate('/app', { replace: true })
  }, [isAuthenticated, navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const normalizedUsername = username.trim()
    if (!/^[a-zA-Z0-9._-]{3,50}$/.test(normalizedUsername)) {
      setValidationError('Логин: 3-50 символов, только латиница, цифры и . _ -')
      return
    }
    if (password.trim().length < 1) {
      setValidationError('Введите пароль')
      return
    }
    setValidationError('')
    dispatch(clearError())
    const result = await dispatch(login({ username: normalizedUsername, password }))
    if (login.fulfilled.match(result)) {
      setCodeError('')
      setCodeModalOpen(true)
    }
  }

  const fillDemo = (u: string, p: string) => {
    dispatch(clearError())
    setValidationError('')
    setUsername(u)
    setPassword(p)
  }

  return (
    <div className={styles.page}>
      {/* Left decorative panel */}
      <div className={styles.leftPanel}>
        <div className={styles.panelContent}>
          <div className={styles.panelLogo}>
            <span className="material-icons-round">eco</span>
            <span>АгроАналитика</span>
          </div>
          <h2 className={styles.panelTitle}>
            Умное управление сельскохозяйственными полями
          </h2>
          <ul className={styles.panelFeatures}>
            <li><span className="material-icons-round">model_training</span>Прогноз урожайности</li>
            <li><span className="material-icons-round">water_drop</span>Рекомендации по поливу</li>
            <li><span className="material-icons-round">cloud</span>Погода в реальном времени</li>
            <li><span className="material-icons-round">sensors_off</span>Проверка показаний с поля</li>
            <li><span className="material-icons-round">notifications_active</span>Уведомления</li>
          </ul>
          <div className={styles.panelStats}>
            <div><strong>7+</strong><span>культур в справочнике</span></div>
            <div><strong>1</strong><span>кабинет для команды</span></div>
            <div><strong>24/7</strong><span>доступ к данным</span></div>
          </div>
        </div>
      </div>

      {/* Right form panel */}
      <div className={styles.rightPanel}>
        <div className={styles.formCard}>
          <div className={styles.formHeader}>
            <span className={`material-icons-round ${styles.formIcon}`}>eco</span>
            <h1 className={styles.formTitle}>Вход в систему</h1>
            <p className={styles.formSub}>Аналитика и прогнозы для ваших полей</p>
          </div>

          {error && (
            <Alert type="error" onClose={() => dispatch(clearError())}>{error}</Alert>
          )}
          {registeredMessage && (
            <Alert type="success">{registeredMessage}</Alert>
          )}
          {validationError && <Alert type="error">{validationError}</Alert>}

          {/* Demo quick-access */}
          <div className={styles.demoSection}>
            <p className={styles.demoLabel}>Быстрый вход</p>
            <div className={styles.demoBtns}>
              {demoAccounts.map(d => (
                <button
                  key={d.username}
                  type="button"
                  className={styles.demoBtn}
                  onClick={() => fillDemo(d.username, d.password)}
                  style={{ borderColor: d.color + '40' }}
                >
                  <span className="material-icons-round" style={{ color: d.color, fontSize: 16 }}>{d.icon}</span>
                  <div>
                    <div className={styles.demoBtnLabel} style={{ color: d.color }}>{d.label}</div>
                    <div className={styles.demoBtnCred}>{d.username} / {d.password}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className={styles.divider}><span>или введите данные вручную</span></div>

          <form onSubmit={handleSubmit} className={styles.form}>
            <Input
              label="Логин"
              icon="person"
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="Введите логин"
              required
              fullWidth
              autoComplete="username"
            />
            <Input
              label="Пароль"
              icon="lock"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Введите пароль"
              required
              fullWidth
              autoComplete="current-password"
            />
            <Button type="submit" loading={loading} fullWidth size="lg">
              Войти
            </Button>
          </form>

          <p className={styles.switchAuth}>
            <Link to="/auth/forgot-password" className={styles.link}>Забыли пароль?</Link>
          </p>
          <p className={styles.switchAuth}>
            Нет аккаунта? <Link to="/auth/register" className={styles.link}>Зарегистрироваться</Link>
          </p>
          <p className={styles.backLink}>
            <Link to="/" className={styles.link}>
              <span className="material-icons-round">arrow_back</span>
              На главную
            </Link>
          </p>
        </div>
      </div>

      <EmailCodeModal
        open={codeModalOpen}
        title="Подтверждение входа"
        description={loginChallengeMessage || 'На вашу почту отправлен 6-значный код подтверждения входа.'}
        emailHint={normalizedEmailHint(username)}
        submitLabel="Подтвердить и войти"
        loading={loading}
        error={codeError}
        expiresInSeconds={loginChallengeExpiresInSeconds}
        canResend
        resendLabel="Отправить код повторно"
        resendLoading={resendLoading}
        resendError={resendError}
        onClose={() => {
          setCodeModalOpen(false)
          setCodeError('')
          setResendError('')
          dispatch(clearLoginChallenge())
        }}
        onResend={async () => {
          if (!loginRequestId) return
          setResendLoading(true)
          setResendError('')
          try {
            const response = await authApi.resendLoginCode(loginRequestId)
            dispatch(setLoginChallenge(response))
          } catch (err: any) {
            setResendError(err.response?.data?.message || 'Не удалось отправить код повторно')
          } finally {
            setResendLoading(false)
          }
        }}
        onSubmit={async (code) => {
          if (!loginRequestId) return
          const result = await dispatch(verifyLoginCode({ requestId: loginRequestId, code }))
          if (verifyLoginCode.rejected.match(result)) {
            setCodeError((result.payload as string) || 'Неверный код')
            return
          }
          setCodeError('')
          setCodeModalOpen(false)
          dispatch(clearLoginChallenge())
          navigate('/app', { replace: true })
        }}
      />
    </div>
  )
}

const normalizedEmailHint = (value: string): string | undefined => {
  const trimmed = value.trim()
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) ? trimmed : undefined
}

export default LoginPage
