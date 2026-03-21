import React from 'react'
import { Link } from 'react-router-dom'
import PrivacyPolicyContent from '@presentation/components/legal/PrivacyPolicyContent'
import styles from './PrivacyPolicyPage.module.scss'

const PrivacyPolicyPage: React.FC = () => (
  <div className={styles.page}>
    <header className={styles.header}>
      <Link to="/" className={styles.back}>
        <span className="material-icons-round">arrow_back</span>
        На главную
      </Link>
    </header>
    <main className={styles.card}>
      <h1 className={styles.title}>Политика конфиденциальности</h1>
      <PrivacyPolicyContent />
    </main>
  </div>
)

export default PrivacyPolicyPage
