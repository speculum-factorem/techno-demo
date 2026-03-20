import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAppDispatch, useAppSelector } from '@application/store/hooks'
import { clearError, register } from '@application/store/slices/authSlice'
import Button from '@presentation/components/common/Button/Button'
import Input from '@presentation/components/common/Input/Input'
import Alert from '@presentation/components/common/Alert/Alert'
import styles from './AuthPage.module.scss'

const STEPS = ['Аккаунт', 'Персональные данные', 'Организация']

const RegisterPage: React.FC = () => {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const { loading, error, isAuthenticated } = useAppSelector(s => s.auth)

  const [step, setStep] = useState(0)
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [organizationId, setOrganizationId] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [passwordError, setPasswordError] = useState('')

  useEffect(() => {
    if (isAuthenticated) navigate('/app', { replace: true })
  }, [isAuthenticated, navigate])

  const validatePassword = (p: string) => {
    if (p.length < 8) return 'Минимум 8 символов'
    if (!/[A-Z]/.test(p)) return 'Нужна хотя бы одна заглавная буква'
    if (!/[0-9]/.test(p)) return 'Нужна хотя бы одна цифра'
    if (!/[^a-zA-Z0-9]/.test(p)) return 'Нужен хотя бы один спецсимвол'
    return ''
  }

  const nextStep = () => {
    dispatch(clearError())
    if (step === 0 && (!username || username.length < 3)) return
    if (step === 1) {
      const err = validatePassword(password)
      if (err) { setPasswordError(err); return }
      if (password !== confirmPassword) { setPasswordError('Пароли не совпадают'); return }
      setPasswordError('')
    }
    setStep(s => Math.min(s + 1, STEPS.length - 1))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (step < STEPS.length - 1) { nextStep(); return }
    dispatch(clearError())
    const result = await dispatch(register({
      username, email, fullName, password, confirmPassword,
      organizationId: organizationId || undefined,
      inviteCode: inviteCode || undefined,
    }))
    if (register.fulfilled.match(result)) {
      navigate('/auth/login', { state: { registeredMessage: result.payload.message } })
    }
  }

  const passwordStrength = () => {
    if (!password) return 0
    let score = 0
    if (password.length >= 8) score++
    if (/[A-Z]/.test(password)) score++
    if (/[0-9]/.test(password)) score++
    if (/[^a-zA-Z0-9]/.test(password)) score++
    return score
  }

  const strength = passwordStrength()
  const strengthColors = ['#ea4335', '#fbbc04', '#fbbc04', '#34a853']
  const strengthLabels = ['', 'Слабый', 'Средний', 'Хороший', 'Надёжный']

  return (
    <div className={styles.page}>
      {/* Left panel */}
      <div className={styles.leftPanel}>
        <div className={styles.panelContent}>
          <div className={styles.panelLogo}>
            <span className="material-icons-round">eco</span>
            <span>АгроАналитика</span>
          </div>
          <h2 className={styles.panelTitle}>Начните управлять агросистемой уже сегодня</h2>
          <div className={styles.registerStepsPanel}>
            {STEPS.map((s, i) => (
              <div key={i} className={`${styles.registerStepItem} ${i <= step ? styles.registerStepActive : ''}`}>
                <div className={styles.registerStepNum}>{i < step ? '✓' : i + 1}</div>
                <span>{s}</span>
              </div>
            ))}
          </div>
          <div className={styles.panelNote}>
            <span className="material-icons-round">info</span>
            Уже есть аккаунт?
            <Link to="/auth/login" className={styles.panelNoteLink}>Войти</Link>
          </div>
        </div>
      </div>

      {/* Right form panel */}
      <div className={styles.rightPanel}>
        <div className={styles.formCard}>
          <div className={styles.formHeader}>
            <span className={`material-icons-round ${styles.formIcon}`} style={{ color: '#34a853' }}>person_add</span>
            <h1 className={styles.formTitle}>Регистрация</h1>
            <p className={styles.formSub}>Шаг {step + 1} из {STEPS.length} — {STEPS[step]}</p>
          </div>

          {/* Progress bar */}
          <div className={styles.progressBar}>
            <div className={styles.progressFill} style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
          </div>

          {error && <Alert type="error" onClose={() => dispatch(clearError())}>{error}</Alert>}

          <form onSubmit={handleSubmit} className={styles.form}>
            {step === 0 && (
              <>
                <Input label="Логин" icon="person" type="text" value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="Например, ivan.petrov" required fullWidth autoComplete="username" minLength={3}
                  hint="Минимум 3 символа, только латиница и цифры"
                />
                <Input label="Email" icon="mail" type="email" value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="example@company.ru" required fullWidth autoComplete="email"
                />
              </>
            )}

            {step === 1 && (
              <>
                <Input label="ФИО" icon="badge" type="text" value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  placeholder="Иван Иванович Петров" required fullWidth autoComplete="name"
                />
                <div>
                  <Input label="Пароль" icon="lock" type="password" value={password}
                    onChange={e => { setPassword(e.target.value); setPasswordError('') }}
                    placeholder="Минимум 8 символов" required fullWidth autoComplete="new-password" minLength={8}
                    error={passwordError}
                  />
                  {password && (
                    <div className={styles.passwordStrength}>
                      {[1,2,3,4].map(i => (
                        <div key={i} className={styles.strengthBar}
                          style={{ background: i <= strength ? strengthColors[strength - 1] : '#dadce0' }} />
                      ))}
                      <span style={{ color: strength > 0 ? strengthColors[strength - 1] : '#9aa0a6' }}>
                        {strengthLabels[strength]}
                      </span>
                    </div>
                  )}
                </div>
                <Input label="Повторите пароль" icon="lock_reset" type="password" value={confirmPassword}
                  onChange={e => { setConfirmPassword(e.target.value); setPasswordError('') }}
                  placeholder="Введите пароль ещё раз" required fullWidth autoComplete="new-password"
                  error={confirmPassword && confirmPassword !== password ? 'Пароли не совпадают' : undefined}
                />
              </>
            )}

            {step === 2 && (
              <>
                <Alert type="info">
                  Поля организации — опциональны. Если у вас есть invite-код, введите его вместе с ID организации.
                </Alert>
                <Input label="ID организации (опционально)" icon="apartment" type="number" value={organizationId}
                  onChange={e => setOrganizationId(e.target.value)}
                  placeholder="Например, 1" fullWidth min={1}
                />
                <Input label="Invite-код (если есть)" icon="key" type="text" value={inviteCode}
                  onChange={e => setInviteCode(e.target.value)}
                  placeholder="Например, ORG1-INVITE-2026" fullWidth
                />
              </>
            )}

            <div className={styles.formActions}>
              {step > 0 && (
                <Button type="button" variant="outlined" onClick={() => setStep(s => s - 1)}>
                  Назад
                </Button>
              )}
              {step < STEPS.length - 1 ? (
                <Button type="button" onClick={nextStep} fullWidth={step === 0}>
                  Далее
                  <span className="material-icons-round" style={{ fontSize: 16 }}>arrow_forward</span>
                </Button>
              ) : (
                <Button type="submit" loading={loading} fullWidth>
                  Создать аккаунт
                </Button>
              )}
            </div>
          </form>

          <p className={styles.switchAuth}>
            Уже есть аккаунт? <Link to="/auth/login" className={styles.link}>Войти</Link>
          </p>
          <p className={styles.backLink}>
            <Link to="/" className={styles.link}>
              <span className="material-icons-round">arrow_back</span>
              На главную
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export default RegisterPage
