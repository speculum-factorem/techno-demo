import React, { useEffect, useState } from 'react'
import Button from '@presentation/components/common/Button/Button'
import Alert from '@presentation/components/common/Alert/Alert'
import styles from './EmailCodeModal.module.scss'

interface EmailCodeModalProps {
  open: boolean
  title: string
  description: string
  emailHint?: string
  submitLabel: string
  loading?: boolean
  error?: string | null
  expiresInSeconds?: number | null
  canResend?: boolean
  resendLabel?: string
  resendLoading?: boolean
  resendError?: string | null
  onResend?: () => Promise<void> | void
  onClose: () => void
  onSubmit: (code: string) => Promise<void> | void
}

const EmailCodeModal: React.FC<EmailCodeModalProps> = ({
  open,
  title,
  description,
  emailHint,
  submitLabel,
  loading = false,
  error,
  expiresInSeconds,
  canResend = false,
  resendLabel = 'Отправить код повторно',
  resendLoading = false,
  resendError,
  onResend,
  onClose,
  onSubmit,
}) => {
  const [codeDigits, setCodeDigits] = useState<string[]>(['', '', '', '', '', ''])
  const [expiresAtMs, setExpiresAtMs] = useState<number | null>(
    expiresInSeconds != null ? Date.now() + expiresInSeconds * 1000 : null
  )
  const [secondsLeft, setSecondsLeft] = useState<number | null>(expiresInSeconds ?? null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  useEffect(() => {
    if (!open) setCodeDigits(['', '', '', '', '', ''])
  }, [open])

  useEffect(() => {
    if (!open) return
    const id = window.setTimeout(() => focusInput(0), 40)
    return () => window.clearTimeout(id)
  }, [open])

  useEffect(() => {
    if (expiresInSeconds == null) {
      setExpiresAtMs(null)
      setSecondsLeft(null)
      return
    }
    const nextExpiresAt = Date.now() + expiresInSeconds * 1000
    setExpiresAtMs(nextExpiresAt)
    setSecondsLeft(Math.max(0, Math.ceil((nextExpiresAt - Date.now()) / 1000)))
  }, [expiresInSeconds, open])

  useEffect(() => {
    if (!open || expiresAtMs === null) return
    const updateTimer = () => {
      const remaining = Math.max(0, Math.ceil((expiresAtMs - Date.now()) / 1000))
      setSecondsLeft(remaining)
    }
    updateTimer()
    const timer = window.setInterval(() => {
      updateTimer()
    }, 1000)
    return () => window.clearInterval(timer)
  }, [open, expiresAtMs])

  if (!open) return null

  const normalizedCode = codeDigits.join('')
  const formatCountdown = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  const focusInput = (index: number) => {
    const el = document.getElementById(`email-code-input-${index}`) as HTMLInputElement | null
    if (el) el.focus()
  }

  const setCodeFromString = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, 6).split('')
    const next = ['', '', '', '', '', '']
    for (let i = 0; i < digits.length; i++) next[i] = digits[i]
    setCodeDigits(next)
    focusInput(Math.min(digits.length, 5))
  }

  return (
    <div
      className={styles.overlay}
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="email-code-modal-title">
        <div className={styles.header}>
          <div className={styles.titleWrap}>
            <span className={`material-icons-round ${styles.titleIcon}`}>mark_email_read</span>
            <h2 id="email-code-modal-title" className={styles.title}>{title}</h2>
          </div>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Закрыть">
            <span className="material-icons-round">close</span>
          </button>
        </div>
        <p className={styles.description}>{description}</p>
        <div className={styles.meta}>
          {emailHint && (
            <p className={styles.emailHint}>
              Письмо отправлено на: <strong>{emailHint}</strong>
            </p>
          )}
          {secondsLeft !== null && (
            <p className={styles.timer}>
              Код действует: <strong>{formatCountdown(secondsLeft)}</strong>
            </p>
          )}
        </div>
        <form
          className={styles.form}
          onSubmit={async (e) => {
            e.preventDefault()
            if (normalizedCode.length !== 6) return
            await onSubmit(normalizedCode)
          }}
        >
          <div className={styles.codeGrid} onPaste={(e) => {
            e.preventDefault()
            setCodeFromString(e.clipboardData.getData('text'))
          }}>
            {codeDigits.map((digit, index) => (
              <input
                key={index}
                id={`email-code-input-${index}`}
                className={styles.codeInput}
                type="text"
                inputMode="numeric"
                autoComplete={index === 0 ? 'one-time-code' : 'off'}
                maxLength={1}
                value={digit}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '')
                  if (!value) {
                    const next = [...codeDigits]
                    next[index] = ''
                    setCodeDigits(next)
                    return
                  }
                  const next = [...codeDigits]
                  next[index] = value[0]
                  setCodeDigits(next)
                  if (index < 5) focusInput(index + 1)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Backspace' && !codeDigits[index] && index > 0) {
                    focusInput(index - 1)
                  }
                  if (e.key === 'ArrowLeft' && index > 0) {
                    e.preventDefault()
                    focusInput(index - 1)
                  }
                  if (e.key === 'ArrowRight' && index < 5) {
                    e.preventDefault()
                    focusInput(index + 1)
                  }
                }}
              />
            ))}
          </div>
          <span className={styles.codeHint}>Введите 6 цифр. Можно вставить весь код сразу.</span>
          {error && <Alert type="error">{error}</Alert>}
          <Button type="submit" fullWidth loading={loading} disabled={normalizedCode.length !== 6}>
            {submitLabel}
          </Button>
          {canResend && onResend && (
            <Button
              type="button"
              variant="ghost"
              fullWidth
              onClick={() => { void onResend() }}
              loading={resendLoading}
            >
              {resendLabel}
            </Button>
          )}
          {resendError && <Alert type="error">{resendError}</Alert>}
        </form>
      </div>
    </div>
  )
}

export default EmailCodeModal
