import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import styles from './LandingPage.module.scss'

const features = [
  { icon: 'dashboard', title: 'Единый дашборд', desc: 'Мгновенный обзор всех полей, рисков и ключевых метрик в одном экране.' },
  { icon: 'model_training', title: 'ML-прогноз урожая', desc: 'RandomForest модель предсказывает урожайность с точностью R² > 0.87 на основе погодных данных.' },
  { icon: 'water_drop', title: 'Умный полив', desc: 'Рекомендации по объёму и времени полива с учётом дефицита влаги и прогноза осадков.' },
  { icon: 'cloud', title: 'Погода в реальном времени', desc: 'Интеграция с Open-Meteo: текущая погода, 7-дневный прогноз и 30-дневная история.' },
  { icon: 'sensors_off', title: 'Обнаружение аномалий', desc: 'Автоматическое выявление сбоев датчиков с пометкой «Низкая достоверность» и рекомендацией проверки.' },
  { icon: 'notifications_active', title: 'Система алертов', desc: 'Мгновенные уведомления по критическим порогам влажности, температуры и засухе. Telegram-интеграция.' },
  { icon: 'history', title: 'Исторический анализ', desc: 'Архивные данные ERA5 по каждому полю с визуализацией трендов за 5 лет.' },
  { icon: 'analytics', title: 'Метрики модели', desc: 'Прозрачная отчётность о качестве ML: MAE, RMSE, R², точность по каждой культуре.' },
]

const stats = [
  { value: '7', label: 'культур поддержано', icon: 'grass' },
  { value: '87%', label: 'точность R² модели', icon: 'percent' },
  { value: '< 1с', label: 'время прогноза', icon: 'speed' },
  { value: '100+', label: 'деревьев в ансамбле', icon: 'account_tree' },
]

const steps = [
  { num: '1', icon: 'person_add', title: 'Создайте аккаунт', desc: 'Зарегистрируйтесь и войдите в систему. Демо-доступ: admin / admin.' },
  { num: '2', icon: 'grass', title: 'Добавьте поля', desc: 'Укажите культуру, площадь, координаты и тип почвы для каждого поля.' },
  { num: '3', icon: 'model_training', title: 'Получайте прогнозы', desc: 'ML-модель автоматически рассчитывает урожайность и рекомендации по поливу.' },
  { num: '4', icon: 'notifications', title: 'Действуйте по алертам', desc: 'Система предупредит об аномалиях и критических условиях до ущерба урожаю.' },
]

const techStack = [
  { name: 'React + Redux', icon: 'web', color: '#61dafb' },
  { name: 'Spring Boot', icon: 'code', color: '#6db33f' },
  { name: 'FastAPI + sklearn', icon: 'psychology', color: '#009688' },
  { name: 'Apache Kafka', icon: 'swap_horiz', color: '#231f20' },
  { name: 'PostgreSQL', icon: 'storage', color: '#336791' },
  { name: 'Open-Meteo API', icon: 'cloud', color: '#1a73e8' },
]

const LandingPage: React.FC = () => {
  const isAuthenticated = !!localStorage.getItem('tokens')
  const navigate = useNavigate()
  const [demoLoading, setDemoLoading] = useState(false)

  const handleDemoLogin = async () => {
    setDemoLoading(true)
    navigate('/auth/login', { state: { prefillUsername: 'admin', prefillPassword: 'admin' } })
  }

  return (
    <div className={styles.page}>

      {/* ===== NAVBAR ===== */}
      <nav className={styles.navbar}>
        <div className={styles.navInner}>
          <div className={styles.brand}>
            <span className={`material-icons-round ${styles.brandIcon}`}>eco</span>
            <span className={styles.brandName}>АгроАналитика</span>
            <span className={styles.brandSub}>Аналитика полей</span>
          </div>
          <div className={styles.navLinks}>
            <a href="#features" className={styles.navLink}>Возможности</a>
            <a href="#how" className={styles.navLink}>Как работает</a>
            <a href="#tech" className={styles.navLink}>Технологии</a>
            <Link to="/about-service" className={styles.navLink}>О сервисе</Link>
            <Link to="/about-app" className={styles.navLink}>О приложении</Link>
            <Link to="/docs" className={styles.navLink}>Документация</Link>
          </div>
          <div className={styles.navActions}>
            {isAuthenticated ? (
              <Link to="/app" className={styles.btnPrimary}>
                <span className="material-icons-round">dashboard</span>
                Открыть приложение
              </Link>
            ) : (
              <>
                <Link to="/auth/login" className={styles.btnOutline}>Войти</Link>
                <Link to="/auth/register" className={styles.btnPrimary}>Регистрация</Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* ===== HERO ===== */}
      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <div className={styles.heroBadge}>
            <span className="material-icons-round">rocket_launch</span>
            Предиктивная аналитика для АПК Ростовской области
          </div>
          <h1 className={styles.heroTitle}>
            Прогнозируйте урожай.<br />
            <span className={styles.heroAccent}>Экономьте воду.</span><br />
            Действуйте раньше рисков.
          </h1>
          <p className={styles.heroDesc}>
            Платформа объединяет ML-прогнозирование урожайности, умные рекомендации по поливу
            и мониторинг погоды в реальном времени — всё в одном интерфейсе для агрономов.
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
                  Начать бесплатно
                </Link>
                <Link
                  to="/auth/login"
                  state={{ prefillUsername: 'admin', prefillPassword: 'admin' }}
                  className={styles.ctaSecondary}
                >
                  <span className="material-icons-round">play_circle</span>
                  Демо-доступ
                </Link>
              </>
            )}
          </div>

          {/* Stats bar */}
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

        {/* Hero visual */}
        <div className={styles.heroVisual}>
          <div className={styles.mockDashboard}>
            <div className={styles.mockHeader}>
              <div className={styles.mockDots}>
                <span /><span /><span />
              </div>
              <span className={styles.mockTitle}>АгроАналитика · Дашборд</span>
            </div>
            <div className={styles.mockBody}>
              <div className={styles.mockCards}>
                <div className={styles.mockCard} style={{ borderColor: '#34a853' }}>
                  <span className="material-icons-round" style={{ color: '#34a853', fontSize: 18 }}>grass</span>
                  <div>
                    <div className={styles.mockCardVal}>4</div>
                    <div className={styles.mockCardLbl}>Активных поля</div>
                  </div>
                </div>
                <div className={styles.mockCard} style={{ borderColor: '#1a73e8' }}>
                  <span className="material-icons-round" style={{ color: '#1a73e8', fontSize: 18 }}>trending_up</span>
                  <div>
                    <div className={styles.mockCardVal}>4.8 т/га</div>
                    <div className={styles.mockCardLbl}>Прогноз пшеница</div>
                  </div>
                </div>
                <div className={styles.mockCard} style={{ borderColor: '#ea4335' }}>
                  <span className="material-icons-round" style={{ color: '#ea4335', fontSize: 18 }}>notifications</span>
                  <div>
                    <div className={styles.mockCardVal}>2</div>
                    <div className={styles.mockCardLbl}>Алерта</div>
                  </div>
                </div>
                <div className={styles.mockCard} style={{ borderColor: '#f59e0b' }}>
                  <span className="material-icons-round" style={{ color: '#f59e0b', fontSize: 18 }}>water_drop</span>
                  <div>
                    <div className={styles.mockCardVal}>3</div>
                    <div className={styles.mockCardLbl}>Полив сегодня</div>
                  </div>
                </div>
              </div>
              <div className={styles.mockChart}>
                <div className={styles.mockChartLabel}>Урожайность по полям (т/га)</div>
                <div className={styles.mockBars}>
                  {[4.8, 2.3, 7.2, 3.9].map((v, i) => (
                    <div key={i} className={styles.mockBarGroup}>
                      <div className={styles.mockBar} style={{ height: `${(v / 8) * 100}%` }} />
                      <div className={styles.mockBarLabel}>П{i + 1}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className={styles.mockAlerts}>
                <div className={styles.mockAlert} style={{ borderColor: '#ea4335', background: '#fff8f7' }}>
                  <span className="material-icons-round" style={{ color: '#ea4335', fontSize: 14 }}>emergency</span>
                  <span>Критическая влажность — Поле №4</span>
                </div>
                <div className={styles.mockAlert} style={{ borderColor: '#fbbc04', background: '#fffbf0' }}>
                  <span className="material-icons-round" style={{ color: '#fbbc04', fontSize: 14 }}>warning</span>
                  <span>Прогноз засухи — 5 дней</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== FEATURES ===== */}
      <section className={styles.features} id="features">
        <div className={styles.sectionInner}>
          <div className={styles.sectionMeta}>
            <div className={styles.sectionTag}>Возможности платформы</div>
            <h2 className={styles.sectionTitle}>Всё для управления урожайностью</h2>
            <p className={styles.sectionDesc}>
              8 модулей, покрывающих полный цикл от мониторинга погоды до рекомендаций полива
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
            <h2 className={styles.sectionTitle}>4 шага до первого прогноза</h2>
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

      {/* ===== TECH STACK ===== */}
      <section className={styles.tech} id="tech">
        <div className={styles.sectionInner}>
          <div className={styles.sectionMeta}>
            <div className={styles.sectionTag}>Технологии</div>
            <h2 className={styles.sectionTitle}>Современный production-ready стек</h2>
            <p className={styles.sectionDesc}>
              Микросервисная архитектура с Kafka, развёрнутая в Docker Compose
            </p>
          </div>
          <div className={styles.techGrid}>
            {techStack.map((t, i) => (
              <div key={i} className={styles.techCard}>
                <span className="material-icons-round" style={{ color: t.color }}>{t.icon}</span>
                <span className={styles.techName}>{t.name}</span>
              </div>
            ))}
          </div>
          <div className={styles.archDiagram}>
            <div className={styles.archRow}>
              <div className={`${styles.archBox} ${styles.archFront}`}>
                <span className="material-icons-round">web</span>
                <span>React Frontend</span>
                <small>:3000</small>
              </div>
            </div>
            <div className={styles.archArrow}>↓ HTTP /api/*</div>
            <div className={styles.archRow}>
              <div className={`${styles.archBox} ${styles.archGateway}`}>
                <span className="material-icons-round">router</span>
                <span>API Gateway</span>
                <small>JWT · :8080</small>
              </div>
            </div>
            <div className={styles.archArrow}>↓ маршрутизация</div>
            <div className={styles.archRow}>
              {['auth :8081', 'fields :8082', 'weather :8083', 'irrigation :8084', 'notifications :8085'].map(s => (
                <div key={s} className={`${styles.archBox} ${styles.archService}`}>
                  <span className="material-icons-round">memory</span>
                  <small>{s}</small>
                </div>
              ))}
            </div>
            <div className={styles.archArrow}>↕ Kafka</div>
            <div className={styles.archRow}>
              <div className={`${styles.archBox} ${styles.archAnalytics}`}>
                <span className="material-icons-round">psychology</span>
                <span>Analytics (ML)</span>
                <small>FastAPI · :8000</small>
              </div>
              <div className={`${styles.archBox} ${styles.archDb}`}>
                <span className="material-icons-round">storage</span>
                <span>PostgreSQL</span>
                <small>6 баз данных</small>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== CTA ===== */}
      {!isAuthenticated && (
        <section className={styles.cta}>
          <div className={styles.ctaInner}>
            <h2>Начните прямо сейчас</h2>
            <p>Создайте аккаунт или войдите с демо-доступом — это бесплатно</p>
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
            <p className={styles.ctaHint}>Демо: <strong>admin / admin</strong> · Агроном: <strong>agronomist / agronomist</strong></p>
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
              <div className={styles.footerSub}>Разработано в рамках хакатона · 2025</div>
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
