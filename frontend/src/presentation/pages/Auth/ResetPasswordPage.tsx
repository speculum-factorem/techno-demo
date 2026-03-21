import React, { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import Button from '@presentation/components/common/Button/Button'
import Input from '@presentation/components/common/Input/Input'
import Alert from '@presentation/components/common/Alert/Alert'
import { authApi } from '@infrastructure/api/AuthApi'
import styles from './AuthPage.module.scss'

const validatePassword = (p: string): string => {
  if (p.length < 8) return 'Минимум 8 символов'
  if (!/[A-Z]/.test(p)) return 'Нужна хотя бы одна заглавная буква'
  if (!/[0-9]/.test(p)) return 'Нужна хотя бы одна цифра'
  if (!/[^a-zA-Z0-9]/.test(p)) return 'Нужен хотя бы один спецсимвол'
  return ''
}

const ResetPasswordPage: React.FC = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [done, setDone] = useState(false)

  if (!token) {
    return (
      <div className={styles.page}>
        <div className={styles.rightPanel} style={{ flex: 1 }}>
          <div className={styles.formCard}>
            <Alert type="error">
              Неверная или отсутствующая ссылка сброса пароля. Запросите новую.
            </Alert>
            <p className={styles.switchAuth}>
              <Link to="/auth/forgot-password" className={styles.link}>Запросить сброс пароля</Link>
            </p>
          </div>
        </div>
      </div>
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const pwErr = validatePassword(newPassword)
    if (pwErr) { setPasswordError(pwErr); return }
    if (newPassword !== confirmPassword) { setPasswordError('Пароли не совпадают'); return }
    setPasswordError('')
    setError('')
    setLoading(true)
    try {
      await authApi.resetPassword(token, newPassword, confirmPassword)
      setDone(true)
      setTimeout(() => navigate('/auth/login', { replace: true }), 3000)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Ошибка при сбросе пароля. Ссылка могла устареть.')
    } finally {
      setLoading(false)
    }
  }

  const strength = (() => {
    if (!newPassword) return 0
    let score = 0
    if (newPassword.length >= 8) score++
    if (/[A-Z]/.test(newPassword)) score++
    if (/[0-9]/.test(newPassword)) score++
    if (/[^a-zA-Z0-9]/.test(newPassword)) score++
    return score
  })()
  const strengthColors = ['#ea4335', '#fbbc04', '#fbbc04', '#34a853']
  const strengthLabels = ['', 'Слабый', 'Средний', 'Хороший', 'Надёжный']

  return (
    <div className={styles.page}>
      {/* Left decorative panel */}
      <div className={styles.leftPanel}>
        <div className={styles.panelContent}>
          <div className={styles.panelLogo}>
            <span className="material-icons-round">eco</span>
            <span>АгроАналитика</span>
          </div>
          <h2 className={styles.panelTitle}>Установите новый пароль</h2>
          <ul className={styles.panelFeatures}>
            <li><span className="material-icons-round">lock</span>Минимум 8 символов</li>
            <li><span className="material-icons-round">abc</span>Заглавные и строчные буквы</li>
            <li><span className="material-icons-round">pin</span>Хотя бы одна цифра</li>
            <li><span className="material-icons-round">star</span>Хотя бы один спецсимвол</li>
          </ul>
        </div>
      </div>

      {/* Right form panel */}
      <div className={styles.rightPanel}>
        <div className={styles.formCard}>
          <div className={styles.formHeader}>
            <span className={`material-icons-round ${styles.formIcon}`} style={{ color: '#1a73e8' }}>lock</span>
            <h1 className={styles.formTitle}>Новый пароль</h1>
            <p className={styles.formSub}>Придумайте надёжный пароль для вашего аккаунта</p>
          </div>

          {error && <Alert type="error" onClose={() => setError('')}>{error}</Alert>}

          {done ? (
            <Alert type="success">
              Пароль успешно изменён! Вы будете перенаправлены на страницу входа...
            </Alert>
          ) : (
            <form onSubmit={handleSubmit} className={styles.form}>
              <div>
                <Input
                  label="Новый пароль"
                  icon="lock"
                  type="password"
                  value={newPassword}
                  onChange={e => { setNewPassword(e.target.value); setPasswordError('') }}
                  placeholder="Минимум 8 символов"
                  required
                  fullWidth
                  autoComplete="new-password"
                  minLength={8}
                  error={passwordError && !confirmPassword ? passwordError : undefined}
                />
                {newPassword && (
                  <div className={styles.passwordStrength}>
                    {[1, 2, 3, 4].map(i => (
                      <div
                        key={i}
                        className={styles.strengthBar}
                        style={{ background: i <= strength ? strengthColors[strength - 1] : '#dadce0' }}
                      />
                    ))}
                    <span style={{ color: strength > 0 ? strengthColors[strength - 1] : '#9aa0a6' }}>
                      {strengthLabels[strength]}
                    </span>
                  </div>
                )}
              </div>
              <Input
                label="Повторите пароль"
                icon="lock_reset"
                type="password"
                value={confirmPassword}
                onChange={e => { setConfirmPassword(e.target.value); setPasswordError('') }}
                placeholder="Введите пароль ещё раз"
                required
                fullWidth
                autoComplete="new-password"
                error={
                  passwordError ||
                  (confirmPassword && confirmPassword !== newPassword ? 'Пароли не совпадают' : undefined)
                }
              />
              <Button type="submit" loading={loading} fullWidth size="lg">
                Установить пароль
              </Button>
            </form>
          )}

          <p className={styles.switchAuth}>
            <Link to="/auth/login" className={styles.link}>Вернуться ко входу</Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export default ResetPasswordPage
