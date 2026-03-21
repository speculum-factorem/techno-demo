import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAppDispatch, useAppSelector } from '@application/store/hooks'
import { clearError, register } from '@application/store/slices/authSlice'
import Button from '@presentation/components/common/Button/Button'
import Input from '@presentation/components/common/Input/Input'
import Alert from '@presentation/components/common/Alert/Alert'
import PrivacyPolicyModal from '@presentation/components/legal/PrivacyPolicyModal'
import { authApi } from '@infrastructure/api/AuthApi'
import EmailCodeModal from './EmailCodeModal'
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
  const [personalDataConsent, setPersonalDataConsent] = useState(false)
  const [consentError, setConsentError] = useState('')
  const [privacyOpen, setPrivacyOpen] = useState(false)
  const [passwordError, setPasswordError] = useState('')
  const [formatError, setFormatError] = useState('')
  const [codeModalOpen, setCodeModalOpen] = useState(false)
  const [codeError, setCodeError] = useState('')
  const [codeExpiresInSeconds, setCodeExpiresInSeconds] = useState<number | null>(null)
  const [resendError, setResendError] = useState('')
  const [resendLoading, setResendLoading] = useState(false)
  const [emailConfigured, setEmailConfigured] = useState<boolean | undefined>(undefined)

  useEffect(() => {
    if (isAuthenticated) navigate('/app', { replace: true })
  }, [isAuthenticated, navigate])

  const validatePassword = (p: string) => {
    if (p.length < 8) return 'Минимум 8 символов'
    if (!/[a-z]/.test(p)) return 'Нужна хотя бы одна строчная буква'
    if (!/[A-Z]/.test(p)) return 'Нужна хотя бы одна заглавная буква'
    if (!/[0-9]/.test(p)) return 'Нужна хотя бы одна цифра'
    if (!/[^a-zA-Z0-9]/.test(p)) return 'Нужен хотя бы один спецсимвол'
    return ''
  }

  const validateStep0 = () => {
    const normalizedUsername = username.trim()
    const normalizedEmail = email.trim()
    if (!/^[a-zA-Z0-9._-]{3,50}$/.test(normalizedUsername)) {
      return 'Логин: 3-50 символов, только латиница, цифры и . _ -'
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return 'Введите корректный email'
    }
    return ''
  }

  const validateStep1 = () => {
    const normalizedFullName = fullName.trim()
    if (!/^[\p{L}\p{M}0-9._'\-\s]{2,120}$/u.test(normalizedFullName)) {
      return 'ФИО: 2–120 символов, буквы (в т.ч. кириллица), пробел, дефис, точка'
    }
    return ''
  }

  const nextStep = () => {
    dispatch(clearError())
    setFormatError('')
    if (step === 0) {
      const err = validateStep0()
      if (err) {
        setFormatError(err)
        return
      }
    }
    if (step === 1) {
      const profileErr = validateStep1()
      if (profileErr) {
        setFormatError(profileErr)
        return
      }
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
    setFormatError('')
    const ti = inviteCode.trim()
    const oid = organizationId.trim()
    if (oid && !ti) {
      setFormatError('Укажите invite-код или удалите ID организации')
      return
    }
    if (ti && !/^[a-zA-Z0-9\-_.]{1,100}$/.test(ti)) {
      setFormatError('Invite-код содержит недопустимые символы')
      return
    }
    if (!personalDataConsent) {
      setConsentError('Необходимо согласие на обработку персональных данных')
      return
    }
    setConsentError('')
    dispatch(clearError())
    const trimmedInvite = inviteCode.trim()
    const trimmedOrg = organizationId.trim()
    const result = await dispatch(register({
      username, email, fullName, password, confirmPassword,
      organizationId: trimmedOrg || undefined,
      inviteCode: trimmedInvite || undefined,
      personalDataConsent: true,
    }))
    if (register.fulfilled.match(result)) {
      const payload = result.payload as { expiresInSeconds?: number; emailConfigured?: boolean }
      setCodeError('')
      setResendError('')
      setCodeExpiresInSeconds(payload.expiresInSeconds ?? null)
      setEmailConfigured(payload.emailConfigured)
      setCodeModalOpen(true)
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
          {formatError && <Alert type="error">{formatError}</Alert>}

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
                  Без invite-кода регистрация без привязки к организации. С кодом можно указать только его
                  (ID организации необязателен) или код и ID вместе — они должны совпадать.
                </Alert>
                <Input label="ID организации (опционально)" icon="apartment" type="number" value={organizationId}
                  onChange={e => setOrganizationId(e.target.value)}
                  placeholder="Например, 1" fullWidth min={1}
                />
                <Input label="Invite-код (если есть)" icon="key" type="text" value={inviteCode}
                  onChange={e => setInviteCode(e.target.value)}
                  placeholder="Например, ORG1-INVITE-2026" fullWidth
                />
                <div className={styles.consentRow}>
                  <input
                    id="pd-consent"
                    type="checkbox"
                    checked={personalDataConsent}
                    onChange={e => { setPersonalDataConsent(e.target.checked); setConsentError('') }}
                    className={styles.consentCheckbox}
                  />
                  <div className={styles.consentText}>
                    <label htmlFor="pd-consent" className={styles.consentLabel}>
                      Согласен с обработкой персональных данных в соответствии с{' '}
                    </label>
                    <button
                      type="button"
                      className={styles.consentPolicyLink}
                      onClick={() => setPrivacyOpen(true)}
                    >
                      Политикой конфиденциальности
                    </button>
                  </div>
                </div>
                {consentError && <span className={styles.consentError}>{consentError}</span>}
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

      <PrivacyPolicyModal open={privacyOpen} onClose={() => setPrivacyOpen(false)} />
      <EmailCodeModal
        open={codeModalOpen}
        title="Подтверждение регистрации"
        description={
          emailConfigured === false
            ? `SMTP не настроен — письмо не отправлено. Код можно найти в логах сервера (email: ${email}).`
            : `Мы отправили 6-значный код на ${email}. Введите его, чтобы завершить регистрацию.`
        }
        emailHint={email.trim()}
        submitLabel="Подтвердить регистрацию"
        loading={loading}
        error={codeError}
        expiresInSeconds={codeExpiresInSeconds}
        canResend
        resendLabel="Отправить код повторно"
        resendLoading={resendLoading}
        resendError={resendError}
        onClose={() => {
          setCodeModalOpen(false)
          setCodeError('')
          setResendError('')
        }}
        onResend={async () => {
          setResendLoading(true)
          setResendError('')
          try {
            const response = await authApi.resendEmailCode(email)
            setCodeExpiresInSeconds(response.expiresInSeconds ?? null)
          } catch (err: any) {
            setResendError(err.response?.data?.message || 'Не удалось отправить код повторно')
          } finally {
            setResendLoading(false)
          }
        }}
        onSubmit={async (code) => {
          try {
            await authApi.verifyEmailWithCode(email, code)
            setCodeError('')
            setCodeModalOpen(false)
            navigate('/auth/login', {
              replace: true,
              state: { registeredMessage: 'Email подтвержден. Теперь можно войти.' },
            })
          } catch (err: any) {
            setCodeError(err.response?.data?.message || 'Неверный или просроченный код')
          }
        }}
      />
    </div>
  )
}

export default RegisterPage
