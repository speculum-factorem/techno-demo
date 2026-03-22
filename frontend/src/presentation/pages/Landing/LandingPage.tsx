import React from 'react'
import { Link } from 'react-router-dom'
import styles from './LandingPage.module.scss'

const features = [
  {
    icon: 'dashboard',
    title: 'Дашборд',
    desc: 'После входа показывает ваши поля из API, сводку погоды (Open-Meteo), прогнозы и рекомендации — по тем данным, что есть в системе.',
  },
  {
    icon: 'model_training',
    title: 'Прогноз урожайности',
    desc: 'Модель scikit-learn (RandomForestRegressor) по погодным и полевым признакам. Раздел «Метрики модели» показывает оценку на тестовой выборке; это не замена фактическому учёту урожая.',
  },
  {
    icon: 'water_drop',
    title: 'Рекомендации по поливу',
    desc: 'Правила по дефициту влажности почвы и прогнозу осадков. Отдельная ML-модель орошения в проекте не используется.',
  },
  {
    icon: 'cloud',
    title: 'Погода',
    desc: 'Текущие условия, прогноз и исторические ряды через Open-Meteo при заданных координатах поля (weather-service).',
  },
  {
    icon: 'sensors_off',
    title: 'Проверка телеметрии',
    desc: 'Отсев явно невозможных значений и статистические отклонения по переданному набору показаний — вспомогательная диагностика, не сертифицированный контроль датчиков.',
  },
  {
    icon: 'notifications_active',
    title: 'Алерты',
    desc: 'Лента в приложении и API уведомлений. Отправка на e-mail и в Telegram — только если заданы переменные окружения (SMTP, токен бота).',
  },
  {
    icon: 'satellite_alt',
    title: 'Спутниковые индексы',
    desc: 'Раздел «Спутниковая аналитика» в приложении использует Sentinel-2 и STAC (Planetary Computer) из analytics-service при доступе в интернет. Экран «Полевой цифровой паспорт» сейчас запрашивает NDVI/NDMI у field-service — там упрощённая кривая для демо, не реальные снимки.',
  },
  {
    icon: 'analytics',
    title: 'Отчёты и операции',
    desc: 'Генерация PDF/Excel, расписание отчётов, задачи, аудит и правила — данные хранятся в сервисах приложения; почта для рассылки настраивается отдельно.',
  },
]

const stats = [
  { value: '6', label: 'схем PostgreSQL в compose', icon: 'storage' },
  { value: '6+', label: 'Java/Python сервисов', icon: 'hub' },
  { value: 'API', label: 'погода: Open-Meteo', icon: 'cloud' },
  { value: 'JWT', label: 'API Gateway', icon: 'vpn_key' },
]

const steps = [
  {
    num: '1',
    icon: 'person_add',
    title: 'Создайте аккаунт',
    desc: 'Регистрация и вход. В типовом docker-compose по умолчанию создаются пользователи admin и agronomist (пароли задаются в README / BOOTSTRAP_* в .env).',
  },
  {
    num: '2',
    icon: 'grass',
    title: 'Добавьте поля',
    desc: 'Укажите культуру, площадь, координаты и тип почвы — данные сохраняются в field-service.',
  },
  {
    num: '3',
    icon: 'model_training',
    title: 'Смотрите прогнозы и рекомендации',
    desc: 'Analytics-service считает прогноз урожайности и рекомендации полива по правилам и модели; нужны координаты для погоды.',
  },
  {
    num: '4',
    icon: 'notifications',
    title: 'Работайте с алертами и журналами',
    desc: 'Уведомления, паспорт поля, отчёты и операционные модули — по мере заполнения данных и настройки интеграций.',
  },
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

  return (
    <div className={styles.page}>

      {/* ===== NAVBAR ===== */}
      <nav className={styles.navbar}>
        <div className={styles.navInner}>
          <div className={styles.brand}>
            <span className={`material-icons-round ${styles.brandIcon}`}>eco</span>
            <span className={styles.brandName}>АгроАналитика</span>
            <span className={styles.brandSub}>Демо веб-платформа</span>
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
            <span className="material-icons-round">science</span>
            Открытый демо-стенд: микросервисы, БД и веб-интерфейс
          </div>
          <h1 className={styles.heroTitle}>
            Учёт полей, погода и аналитика<br />
            <span className={styles.heroAccent}>в одном приложении</span>
          </h1>
          <p className={styles.heroDesc}>
            Проект для хакатона/портфолио: поля и организации в PostgreSQL, прогноз урожайности на scikit-learn,
            погода через Open-Meteo, опционально спутник Sentinel-2 и отчёты. Это не коммерческий продукт
            и не замена учётным системам хозяйства без доработки и валидации на ваших данных.
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
                  Вход (демо admin)
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
            Не реальные данные: схема интерфейса. После входа цифры и графики строятся из API по вашим полям и настройкам.
          </p>
          <div className={styles.wireframe}>
            <div className={styles.wireframeTopBar}>
              <span className={styles.wireframeDots}><span /><span /><span /></span>
              <span className={styles.wireframeTitle}>Приложение · обзор</span>
            </div>
            <div className={styles.wireframeBody}>
              <div className={styles.wireframeGrid}>
                <div className={styles.wireframeCard}>
                  <span className="material-icons-round">grass</span>
                  <span className={styles.wireframeCardLabel}>Поля</span>
                  <span className={styles.wireframeCardHint}>из field-service</span>
                </div>
                <div className={styles.wireframeCard}>
                  <span className="material-icons-round">cloud</span>
                  <span className={styles.wireframeCardLabel}>Погода</span>
                  <span className={styles.wireframeCardHint}>Open-Meteo</span>
                </div>
                <div className={styles.wireframeCard}>
                  <span className="material-icons-round">trending_up</span>
                  <span className={styles.wireframeCardLabel}>Прогноз</span>
                  <span className={styles.wireframeCardHint}>analytics ML</span>
                </div>
                <div className={styles.wireframeCard}>
                  <span className="material-icons-round">notifications</span>
                  <span className={styles.wireframeCardLabel}>Алерты</span>
                  <span className={styles.wireframeCardHint}>notification-service</span>
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
            <h2 className={styles.sectionTitle}>Что есть в коде и в интерфейсе</h2>
            <p className={styles.sectionDesc}>
              Ниже — соответствие реализованным сервисам; точность прогнозов и полнота данных зависят от вашего развёртывания и входных данных.
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

      {/* ===== TECH STACK ===== */}
      <section className={styles.tech} id="tech">
        <div className={styles.sectionInner}>
          <div className={styles.sectionMeta}>
            <div className={styles.sectionTag}>Технологии</div>
            <h2 className={styles.sectionTitle}>Стек демо-развёртывания</h2>
            <p className={styles.sectionDesc}>
              Собирается через Docker Compose: отдельные процессы и схемы PostgreSQL на один инстанс СУБД.
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
                <small>6 схем (БД)</small>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== CTA ===== */}
      {!isAuthenticated && (
        <section className={styles.cta}>
          <div className={styles.ctaInner}>
            <h2>Попробовать демо</h2>
            <p>Создайте аккаунт или войдите тестовым пользователем из README репозитория</p>
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
              По умолчанию в compose: <strong>admin</strong> / пароль из <code>BOOTSTRAP_ADMIN_PASSWORD</code> (часто <strong>admin</strong>);
              {' '}<strong>agronomist</strong> / <strong>agronomist</strong> — см. <code>README.md</code> и <code>.env.example</code>.
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
              <div className={styles.footerSub}>Учебный / демо-проект · исходники в репозитории</div>
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
