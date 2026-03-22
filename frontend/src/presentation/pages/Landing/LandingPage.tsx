import React from 'react'
import { Link } from 'react-router-dom'
import styles from './LandingPage.module.scss'

const features = [
  {
    icon: 'dashboard',
    title: 'Дашборд',
    desc: 'Сводка по полям, погоде, прогнозам и рекомендациям в одном окне.',
  },
  {
    icon: 'model_training',
    title: 'Прогноз урожайности',
    desc: 'Оценка урожайности с учётом погоды и данных поля; отдельный раздел с проверкой качества прогноза.',
  },
  {
    icon: 'water_drop',
    title: 'Рекомендации по поливу',
    desc: 'Подсказки по влажности почвы и осадкам, план задач на полив.',
  },
  {
    icon: 'cloud',
    title: 'Погода',
    desc: 'Текущие условия, прогноз и история по координатам поля.',
  },
  {
    icon: 'sensors_off',
    title: 'Проверка показаний',
    desc: 'Подсветка подозрительных значений с поля — вспомогательная проверка перед решениями.',
  },
  {
    icon: 'notifications_active',
    title: 'Уведомления',
    desc: 'Лента событий в приложении; при настройке — доставка на почту и в мессенджеры.',
  },
  {
    icon: 'satellite_alt',
    title: 'Спутниковые слои',
    desc: 'Вегетация и влажность по снимкам; в паспорте поля — динамика по выбранному полю.',
  },
  {
    icon: 'analytics',
    title: 'Отчёты и операции',
    desc: 'Отчёты в PDF и Excel, расписание, задачи, журнал действий и правила оповещений.',
  },
]

const stats = [
  { value: '15+', label: 'разделов приложения', icon: 'dashboard' },
  { value: '1', label: 'кабинет для команды', icon: 'groups' },
  { value: '24/7', label: 'доступ к данным', icon: 'cloud' },
  { value: '✓', label: 'роли и организации', icon: 'verified_user' },
]

const steps = [
  {
    num: '1',
    icon: 'person_add',
    title: 'Создайте аккаунт',
    desc: 'Регистрация и вход. При необходимости администратор выдаст доступ к организации.',
  },
  {
    num: '2',
    icon: 'grass',
    title: 'Добавьте поля',
    desc: 'Укажите культуру, площадь, координаты и тип почвы — данные сохраняются в вашем кабинете.',
  },
  {
    num: '3',
    icon: 'model_training',
    title: 'Смотрите прогнозы и рекомендации',
    desc: 'Прогноз урожайности и полив строятся по погоде и карточке поля.',
  },
  {
    num: '4',
    icon: 'notifications',
    title: 'Работайте с уведомлениями и отчётами',
    desc: 'Алерты, паспорт поля, отчёты и интеграции — по мере наполнения данными.',
  },
]

const platformPillars = [
  { name: 'Веб-интерфейс', icon: 'web', color: '#1a73e8' },
  { name: 'Прогнозы и аналитика', icon: 'insights', color: '#34a853' },
  { name: 'Погода и спутник', icon: 'cloud', color: '#4285f4' },
  { name: 'Хранение данных', icon: 'storage', color: '#5f6368' },
  { name: 'Уведомления', icon: 'notifications', color: '#f9ab00' },
]

const LandingPage: React.FC = () => {
  const isAuthenticated = !!localStorage.getItem('tokens')
  const [menuOpen, setMenuOpen] = React.useState(false)

  const closeMenu = () => setMenuOpen(false)

  React.useEffect(() => {
    const onResize = () => {
      if (window.innerWidth > 768) setMenuOpen(false)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  React.useEffect(() => {
    if (!menuOpen) return
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    window.addEventListener('keydown', onEsc)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onEsc)
      document.body.style.overflow = prev
    }
  }, [menuOpen])

  return (
    <div className={styles.page}>

      {/* ===== NAVBAR ===== */}
      <nav className={styles.navbar}>
        <div className={styles.navInner}>
          <Link to="/" className={styles.brand} onClick={closeMenu}>
            <span className={`material-icons-round ${styles.brandIcon}`}>eco</span>
            <span className={styles.brandName}>АгроАналитика</span>
            <span className={styles.brandSub}>Веб-платформа</span>
          </Link>
          <div className={styles.navLinks}>
            <a href="#features" className={styles.navLink}>Возможности</a>
            <a href="#how" className={styles.navLink}>Как работает</a>
            <a href="#tech" className={styles.navLink}>Платформа</a>
            <Link to="/about-service" className={styles.navLink}>О сервисе</Link>
            <Link to="/about-app" className={styles.navLink}>О приложении</Link>
            <Link to="/docs" className={styles.navLink}>Документация</Link>
          </div>
          <div className={styles.navActions}>
            {isAuthenticated ? (
              <Link to="/app" className={styles.btnPrimary} aria-label="Открыть приложение">
                <span className="material-icons-round">dashboard</span>
                <span className={styles.navBtnLabel}>Открыть приложение</span>
              </Link>
            ) : (
              <>
                <Link to="/auth/login" className={styles.btnOutline}>Войти</Link>
                <Link to="/auth/register" className={styles.btnPrimary}>Регистрация</Link>
              </>
            )}
          </div>
          <button
            type="button"
            className={styles.navMenuBtn}
            aria-label={menuOpen ? 'Закрыть меню' : 'Открыть меню'}
            aria-expanded={menuOpen}
            aria-controls="landing-nav-drawer"
            onClick={() => setMenuOpen(o => !o)}
          >
            <span className="material-icons-round">{menuOpen ? 'close' : 'menu'}</span>
          </button>
        </div>
      </nav>
      <div
        className={`${styles.navDrawer} ${menuOpen ? styles.navDrawerOpen : ''}`}
        id="landing-nav-drawer"
        aria-hidden={!menuOpen}
      >
        <a href="#features" className={styles.navDrawerLink} onClick={closeMenu}>Возможности</a>
        <a href="#how" className={styles.navDrawerLink} onClick={closeMenu}>Как работает</a>
        <a href="#tech" className={styles.navDrawerLink} onClick={closeMenu}>Платформа</a>
        <Link to="/about-service" className={styles.navDrawerLink} onClick={closeMenu}>О сервисе</Link>
        <Link to="/about-app" className={styles.navDrawerLink} onClick={closeMenu}>О приложении</Link>
        <Link to="/docs" className={styles.navDrawerLink} onClick={closeMenu}>Документация</Link>
        {isAuthenticated ? (
          <Link to="/app" className={styles.navDrawerCta} onClick={closeMenu}>
            <span className="material-icons-round">dashboard</span>
            Открыть приложение
          </Link>
        ) : (
          <div className={styles.navDrawerActions}>
            <Link to="/auth/login" className={styles.navDrawerSecondary} onClick={closeMenu}>Войти</Link>
            <Link to="/auth/register" className={styles.navDrawerPrimary} onClick={closeMenu}>Регистрация</Link>
          </div>
        )}
      </div>
      {menuOpen && (
        <button
          type="button"
          className={styles.navDrawerBackdrop}
          aria-label="Закрыть меню"
          onClick={closeMenu}
        />
      )}

      {/* ===== HERO ===== */}
      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <div className={styles.heroBadge}>
            <span className="material-icons-round">agriculture</span>
            Учёт полей, погода и прогнозы в одном месте
          </div>
          <h1 className={styles.heroTitle}>
            Учёт полей, погода и аналитика<br />
            <span className={styles.heroAccent}>в одном приложении</span>
          </h1>
          <p className={styles.heroDesc}>
            Добавляйте поля, смотрите погоду и прогноз урожайности, получайте рекомендации по поливу и спутниковые слои.
            Удобно агрономам и руководителям хозяйства — решения принимайте с опорой на свои данные.
          </p>
          <div className={styles.heroCta}>
            {isAuthenticated ? (
              <Link to="/app" className={styles.ctaPrimary}>
                <span className="material-icons-round">dashboard</span>
                Перейти в приложение
              </Link>
            ) : (
              <>
                <Link to="/auth/register" className={styles.ctaPrimary}>
                  <span className="material-icons-round">person_add</span>
                  Зарегистрироваться
                </Link>
                <Link
                  to="/auth/login"
                  state={{ prefillUsername: 'admin', prefillPassword: 'admin' }}
                  className={styles.ctaSecondary}
                >
                  <span className="material-icons-round">play_circle</span>
                  Войти как admin
                </Link>
              </>
            )}
          </div>

          <div className={styles.statsBar}>
            {stats.map(s => (
              <div key={s.label} className={styles.statItem}>
                <span className="material-icons-round">{s.icon}</span>
                <div>
                  <div className={styles.statValue}>{s.value}</div>
                  <div className={styles.statLabel}>{s.label}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.heroVisual}>
          <p className={styles.wireframeDisclaimer}>
            Пример экрана. После входа отображаются ваши поля, графики и показатели.
          </p>
          <div className={styles.wireframe}>
            <div className={styles.wireframeTopBar}>
              <span className={styles.wireframeDots}><span /><span /><span /></span>
              <span className={styles.wireframeTitle}>Приложение · обзор</span>
              <span className={styles.wireframeTopBarBalance} aria-hidden />
            </div>
            <div className={styles.wireframeBody}>
              <div className={styles.wireframeGrid}>
                <div className={styles.wireframeCard}>
                  <span className={`material-icons-round ${styles.wireframeCardIcon}`}>grass</span>
                  <div className={styles.wireframeCardText}>
                    <span className={styles.wireframeCardLabel}>Поля</span>
                    <span className={styles.wireframeCardHint}>ваши участки</span>
                  </div>
                </div>
                <div className={styles.wireframeCard}>
                  <span className={`material-icons-round ${styles.wireframeCardIcon}`}>cloud</span>
                  <div className={styles.wireframeCardText}>
                    <span className={styles.wireframeCardLabel}>Погода</span>
                    <span className={styles.wireframeCardHint}>прогноз</span>
                  </div>
                </div>
                <div className={styles.wireframeCard}>
                  <span className={`material-icons-round ${styles.wireframeCardIcon}`}>trending_up</span>
                  <div className={styles.wireframeCardText}>
                    <span className={styles.wireframeCardLabel}>Прогноз</span>
                    <span className={styles.wireframeCardHint}>урожайность</span>
                  </div>
                </div>
                <div className={styles.wireframeCard}>
                  <span className={`material-icons-round ${styles.wireframeCardIcon}`}>notifications</span>
                  <div className={styles.wireframeCardText}>
                    <span className={styles.wireframeCardLabel}>Алерты</span>
                    <span className={styles.wireframeCardHint}>события</span>
                  </div>
                </div>
              </div>
              <div className={styles.wireframeChart}>
                <span className={styles.wireframeChartLabel}>Графики и таблицы</span>
                <div className={styles.wireframeChartPlaceholder} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== FEATURES ===== */}
      <section className={styles.features} id="features">
        <div className={styles.sectionInner}>
          <div className={styles.sectionMeta}>
            <div className={styles.sectionTag}>Возможности</div>
            <h2 className={styles.sectionTitle}>Что умеет приложение</h2>
            <p className={styles.sectionDesc}>
              Основные разделы кабинета. Точность прогнозов зависит от полноты ваших данных и настроек.
            </p>
          </div>
          <div className={styles.featuresGrid}>
            {features.map((f, i) => (
              <div key={i} className={styles.featureCard}>
                <div className={styles.featureIcon}>
                  <span className="material-icons-round">{f.icon}</span>
                </div>
                <h3 className={styles.featureTitle}>{f.title}</h3>
                <p className={styles.featureDesc}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== HOW IT WORKS ===== */}
      <section className={styles.howItWorks} id="how">
        <div className={styles.sectionInner}>
          <div className={styles.sectionMeta}>
            <div className={styles.sectionTag}>Как начать</div>
            <h2 className={styles.sectionTitle}>Типовой сценарий</h2>
          </div>
          <div className={styles.steps}>
            {steps.map((s, i) => (
              <div key={i} className={styles.step}>
                <div className={styles.stepLeft}>
                  <div className={styles.stepNum}>{s.num}</div>
                  {i < steps.length - 1 && <div className={styles.stepLine} />}
                </div>
                <div className={styles.stepContent}>
                  <div className={styles.stepIcon}>
                    <span className="material-icons-round">{s.icon}</span>
                  </div>
                  <div>
                    <h3 className={styles.stepTitle}>{s.title}</h3>
                    <p className={styles.stepDesc}>{s.desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== PLATFORM ===== */}
      <section className={styles.tech} id="tech">
        <div className={styles.sectionInner}>
          <div className={styles.sectionMeta}>
            <div className={styles.sectionTag}>Платформа</div>
            <h2 className={styles.sectionTitle}>Всё связано в одном кабинете</h2>
            <p className={styles.sectionDesc}>
              Поля, погода, расчёты и отчёты работают вместе: не нужно собирать таблицы вручную из разных источников.
            </p>
          </div>
          <div className={styles.techGrid}>
            {platformPillars.map((t, i) => (
              <div key={i} className={styles.techCard}>
                <span className="material-icons-round" style={{ color: t.color }}>{t.icon}</span>
                <span className={styles.techName}>{t.name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== CTA ===== */}
      {!isAuthenticated && (
        <section className={styles.cta}>
          <div className={styles.ctaInner}>
            <h2>Начать работу</h2>
            <p>Создайте аккаунт или войдите под учётной записью, которую выдал администратор</p>
            <div className={styles.ctaButtons}>
              <Link to="/auth/register" className={styles.ctaBtnPrimary}>
                <span className="material-icons-round">person_add</span>
                Создать аккаунт
              </Link>
              <Link
                to="/auth/login"
                state={{ prefillUsername: 'admin', prefillPassword: 'admin' }}
                className={styles.ctaBtnOutline}
              >
                <span className="material-icons-round">play_circle</span>
                Войти как admin
              </Link>
            </div>
            <p className={styles.ctaHint}>
              На учебных стендах часто доступны учётные записи <strong>admin</strong> и <strong>agronomist</strong> — уточните пароль у администратора развёртывания.
            </p>
          </div>
        </section>
      )}

      {/* ===== FOOTER ===== */}
      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <div className={styles.footerBrand}>
            <span className={`material-icons-round ${styles.footerIcon}`}>eco</span>
            <div>
              <div className={styles.footerName}>АгроАналитика</div>
              <div className={styles.footerSub}>Цифровой кабинет для полей и прогнозов</div>
            </div>
          </div>
          <div className={styles.footerLinks}>
            <Link to="/auth/login" className={styles.footerLink}>Войти</Link>
            <Link to="/auth/register" className={styles.footerLink}>Регистрация</Link>
            <Link to="/about-service" className={styles.footerLink}>О сервисе</Link>
            <Link to="/about-app" className={styles.footerLink}>О приложении</Link>
            <Link to="/docs" className={styles.footerLink}>Документация</Link>
            <Link to="/privacy" className={styles.footerLink}>Конфиденциальность</Link>
            {isAuthenticated && <Link to="/app" className={styles.footerLink}>Приложение</Link>}
          </div>
        </div>
      </footer>
    </div>
  )
}

export default LandingPage
