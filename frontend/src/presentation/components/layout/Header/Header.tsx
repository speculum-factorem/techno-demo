import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAppDispatch, useAppSelector } from '@application/store/hooks'
import { logout } from '@application/store/slices/authSlice'
import styles from './Header.module.scss'

const Header: React.FC = () => {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const { user } = useAppSelector(s => s.auth)
  const { unreadCount } = useAppSelector(s => s.alerts)
  const [showMenu, setShowMenu] = useState(false)

  const handleLogout = async () => {
    await dispatch(logout())
    navigate('/auth/login')
  }

  return (
    <header className={styles.header}>
      <div className={styles.left}>
        <Link to="/" className={styles.logo}>
          <span className={`material-icons-round ${styles.logoIcon}`}>eco</span>
          <div className={styles.logoText}>
            <span className={styles.logoTitle}>АгроАналитика</span>
            <span className={styles.logoSub}>Центр-Инвест</span>
          </div>
        </Link>
      </div>

      <div className={styles.right}>
        <Link to="/alerts" className={styles.iconBtn} title="Уведомления">
          <span className="material-icons-round">notifications</span>
          {unreadCount > 0 && (
            <span className={styles.badge}>{unreadCount > 9 ? '9+' : unreadCount}</span>
          )}
        </Link>

        <div className={styles.userMenu}>
          <button className={styles.avatarBtn} onClick={() => setShowMenu(!showMenu)}>
            <div className={styles.avatar}>
              {user?.fullName?.charAt(0) || 'A'}
            </div>
          </button>
          {showMenu && (
            <div className={styles.dropdown}>
              <div className={styles.dropdownHeader}>
                <div className={styles.avatar}>{user?.fullName?.charAt(0) || 'A'}</div>
                <div>
                  <div className={styles.dropdownName}>{user?.fullName}</div>
                  <div className={styles.dropdownEmail}>{user?.email}</div>
                </div>
              </div>
              <div className={styles.dropdownDivider} />
              <button className={styles.dropdownItem} onClick={handleLogout}>
                <span className="material-icons-round">logout</span>
                Выйти
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

export default Header
