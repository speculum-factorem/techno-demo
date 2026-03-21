import React, { useEffect, useState } from 'react'
import Button from '@presentation/components/common/Button/Button'
import Input from '@presentation/components/common/Input/Input'
import Alert from '@presentation/components/common/Alert/Alert'
import styles from './EmailCodeModal.module.scss'

interface EmailCodeModalProps {
  open: boolean
  title: string
  description: string
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
  const [code, setCode] = useState('')
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
    if (!open) setCode('')
  }, [open])

  useEffect(() => {
    setSecondsLeft(expiresInSeconds ?? null)
  }, [expiresInSeconds, open])

  useEffect(() => {
    if (!open || secondsLeft === null || secondsLeft <= 0) return
    const timer = window.setInterval(() => {
      setSecondsLeft(prev => (prev === null ? null : Math.max(0, prev - 1)))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [open, secondsLeft])

  if (!open) return null

  const normalizedCode = code.replace(/\D/g, '').slice(0, 6)
  const formatCountdown = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
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
          <h2 id="email-code-modal-title" className={styles.title}>{title}</h2>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Закрыть">
            <span className="material-icons-round">close</span>
          </button>
        </div>
        <p className={styles.description}>{description}</p>
        {secondsLeft !== null && (
          <p className={styles.timer}>
            Код действует: <strong>{formatCountdown(secondsLeft)}</strong>
          </p>
        )}
        <form
          className={styles.form}
          onSubmit={async (e) => {
            e.preventDefault()
            if (normalizedCode.length !== 6) return
            await onSubmit(normalizedCode)
          }}
        >
          <Input
            label="Код из письма"
            icon="pin"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={normalizedCode}
            onChange={(e) => setCode(e.target.value)}
            placeholder="000000"
            fullWidth
            hint="Введите 6 цифр"
          />
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
