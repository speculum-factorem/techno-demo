import React, { useEffect } from 'react'
import PrivacyPolicyContent from './PrivacyPolicyContent'
import styles from './PrivacyPolicyModal.module.scss'

interface PrivacyPolicyModalProps {
  open: boolean
  onClose: () => void
}

const PrivacyPolicyModal: React.FC<PrivacyPolicyModalProps> = ({ open, onClose }) => {
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

  if (!open) return null

  return (
    <div
      className={styles.overlay}
      role="presentation"
      onClick={e => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="privacy-policy-title"
      >
        <div className={styles.header}>
          <h1 id="privacy-policy-title" className={styles.title}>
            Политика конфиденциальности
          </h1>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Закрыть"
          >
            <span className="material-icons-round">close</span>
          </button>
        </div>
        <div className={styles.body}>
          <PrivacyPolicyContent />
        </div>
        <div className={styles.footer}>
          <button type="button" className={styles.okBtn} onClick={onClose}>
            Понятно
          </button>
        </div>
      </div>
    </div>
  )
}

export default PrivacyPolicyModal
