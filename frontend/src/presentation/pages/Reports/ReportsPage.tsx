import React, { useState } from 'react'
import styles from './ReportsPage.module.scss'

interface ReportTemplate {
  id: string
  name: string
  description: string
  icon: string
  category: 'analytics' | 'finance' | 'operations' | 'compliance'
  formats: ('pdf' | 'excel')[]
  frequency?: 'weekly' | 'monthly'
  lastGenerated?: string
  pages?: number
}

const TEMPLATES: ReportTemplate[] = [
  { id: 'r1', name: 'Недельный дайджест', description: 'Сводка по всем полям: урожай, полив, алерты, погода за неделю', icon: 'summarize', category: 'analytics', formats: ['pdf', 'excel'], frequency: 'weekly', lastGenerated: '2026-03-19', pages: 12 },
  { id: 'r2', name: 'Финансовая сводка', description: 'Себестоимость, экономия воды, ROI, маржинальность по культурам', icon: 'account_balance', category: 'finance', formats: ['pdf', 'excel'], frequency: 'monthly', lastGenerated: '2026-02-28', pages: 8 },
  { id: 'r3', name: 'Прогноз урожая', description: 'Детальный прогноз RandomForest с метриками по каждому полю', icon: 'trending_up', category: 'analytics', formats: ['pdf'], lastGenerated: '2026-03-15', pages: 18 },
  { id: 'r4', name: 'Отчёт по поливу', description: 'Объёмы полива, рекомендации, принятые/отклонённые решения', icon: 'water_drop', category: 'operations', formats: ['pdf', 'excel'], lastGenerated: '2026-03-18', pages: 6 },
  { id: 'r5', name: 'Аудит действий', description: 'Журнал всех действий пользователей за выбранный период', icon: 'manage_history', category: 'compliance', formats: ['pdf', 'excel'] },
  { id: 'r6', name: 'Состояние техники', description: 'SLA устройств, аптайм, качество данных, алерты по сенсорам', icon: 'device_hub', category: 'operations', formats: ['pdf', 'excel'], lastGenerated: '2026-03-20', pages: 5 },
  { id: 'r7', name: 'Спутниковый отчёт NDVI/NDMI', description: 'Динамика индексов, зоны стресса, тренды по полям', icon: 'satellite_alt', category: 'analytics', formats: ['pdf'] },
  { id: 'r8', name: 'Ежемесячный отчёт для руководства', description: 'Исполнительное резюме: KPI, финансы, прогнозы, риски', icon: 'business_center', category: 'compliance', formats: ['pdf'], frequency: 'monthly', lastGenerated: '2026-02-28', pages: 24 },
]

const CATEGORY_LABELS: Record<string, string> = {
  analytics: 'Аналитика', finance: 'Финансы', operations: 'Операции', compliance: 'Отчётность',
}
const CATEGORY_COLORS: Record<string, string> = {
  analytics: '#1a73e8', finance: '#34a853', operations: '#f9ab00', compliance: '#9c27b0',
}

interface ScheduledReport {
  id: string
  templateId: string
  name: string
  frequency: 'weekly' | 'monthly'
  nextRun: string
  recipients: string[]
  format: 'pdf' | 'excel'
  channel: 'email' | 'telegram'
}

const MOCK_SCHEDULED: ScheduledReport[] = [
  { id: 's1', templateId: 'r1', name: 'Недельный дайджест', frequency: 'weekly', nextRun: '2026-03-27', recipients: ['admin@agro.ru', 'manager@agro.ru'], format: 'pdf', channel: 'email' },
  { id: 's2', templateId: 'r2', name: 'Финансовая сводка', frequency: 'monthly', nextRun: '2026-04-01', recipients: ['cfo@agro.ru'], format: 'excel', channel: 'email' },
  { id: 's3', templateId: 'r8', name: 'Отчёт для руководства', frequency: 'monthly', nextRun: '2026-04-01', recipients: ['ceo@agro.ru'], format: 'pdf', channel: 'telegram' },
]

const ReportsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'templates' | 'scheduled' | 'history'>('templates')
  const [filterCat, setFilterCat] = useState<string>('all')
  const [generating, setGenerating] = useState<string | null>(null)
  const [showSchedule, setShowSchedule] = useState(false)

  const filtered = TEMPLATES.filter(t => filterCat === 'all' || t.category === filterCat)

  const generate = (id: string, format: string) => {
    setGenerating(id)
    setTimeout(() => {
      setGenerating(null)
      alert(`✅ Отчёт "${TEMPLATES.find(t => t.id === id)?.name}" (${format.toUpperCase()}) сгенерирован и готов к скачиванию`)
    }, 1800)
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}><span className="material-icons-round">description</span> Отчёты и экспорт</h1>
          <p className={styles.sub}>PDF/Excel отчёты для руководства, плановые рассылки по Email и Telegram</p>
        </div>
        <button className={styles.scheduleBtn} onClick={() => setShowSchedule(true)}>
          <span className="material-icons-round">schedule_send</span> Настроить рассылку
        </button>
      </div>

      {/* Quick stats */}
      <div className={styles.statsRow}>
        {[
          { label: 'Шаблонов', value: TEMPLATES.length, icon: 'description', color: '#1a73e8' },
          { label: 'Плановых рассылок', value: MOCK_SCHEDULED.length, icon: 'schedule_send', color: '#34a853' },
          { label: 'Сгенерировано', value: '48', icon: 'download_done', color: '#f9ab00' },
          { label: 'Получателей', value: '7', icon: 'group', color: '#9c27b0' },
        ].map(s => (
          <div key={s.label} className={styles.statCard}>
            <span className="material-icons-round" style={{ color: s.color }}>{s.icon}</span>
            <strong style={{ color: s.color }}>{s.value}</strong>
            <span>{s.label}</span>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        {(['templates', 'scheduled', 'history'] as const).map(tab => (
          <button key={tab} className={`${styles.tab} ${activeTab === tab ? styles.activeTab : ''}`} onClick={() => setActiveTab(tab)}>
            <span className="material-icons-round">
              {tab === 'templates' ? 'library_books' : tab === 'scheduled' ? 'schedule_send' : 'history'}
            </span>
            {tab === 'templates' ? 'Шаблоны' : tab === 'scheduled' ? 'Расписание' : 'История'}
          </button>
        ))}
      </div>

      {activeTab === 'templates' && (
        <>
          <div className={styles.catFilters}>
            <button className={`${styles.catBtn} ${filterCat === 'all' ? styles.activeCatBtn : ''}`} onClick={() => setFilterCat('all')}>Все</button>
            {Object.keys(CATEGORY_LABELS).map(c => (
              <button key={c} className={`${styles.catBtn} ${filterCat === c ? styles.activeCatBtn : ''}`}
                onClick={() => setFilterCat(c)}
                style={filterCat === c ? { background: CATEGORY_COLORS[c] + '22', color: CATEGORY_COLORS[c], borderColor: CATEGORY_COLORS[c] } : {}}>
                {CATEGORY_LABELS[c]}
              </button>
            ))}
          </div>
          <div className={styles.templateGrid}>
            {filtered.map(t => (
              <div key={t.id} className={styles.templateCard}>
                <div className={styles.templateIcon} style={{ color: CATEGORY_COLORS[t.category] }}>
                  <span className="material-icons-round">{t.icon}</span>
                </div>
                <div className={styles.templateBody}>
                  <div className={styles.templateTop}>
                    <span className={styles.templateName}>{t.name}</span>
                    <span className={styles.catBadge} style={{ background: CATEGORY_COLORS[t.category] + '22', color: CATEGORY_COLORS[t.category] }}>
                      {CATEGORY_LABELS[t.category]}
                    </span>
                  </div>
                  <p className={styles.templateDesc}>{t.description}</p>
                  <div className={styles.templateMeta}>
                    {t.lastGenerated && <span><span className="material-icons-round" style={{ fontSize: 13 }}>schedule</span> {t.lastGenerated}</span>}
                    {t.pages && <span><span className="material-icons-round" style={{ fontSize: 13 }}>pages</span> {t.pages} стр.</span>}
                    {t.frequency && <span><span className="material-icons-round" style={{ fontSize: 13 }}>refresh</span> {t.frequency === 'weekly' ? 'Еженедельно' : 'Ежемесячно'}</span>}
                  </div>
                  <div className={styles.templateActions}>
                    {t.formats.includes('pdf') && (
                      <button className={`${styles.genBtn} ${styles.pdfBtn}`} onClick={() => generate(t.id, 'pdf')} disabled={generating === t.id}>
                        {generating === t.id ? <span className={styles.spinner} /> : <span className="material-icons-round">picture_as_pdf</span>}
                        PDF
                      </button>
                    )}
                    {t.formats.includes('excel') && (
                      <button className={`${styles.genBtn} ${styles.xlsBtn}`} onClick={() => generate(t.id, 'excel')} disabled={generating === t.id}>
                        <span className="material-icons-round">table_chart</span> Excel
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {activeTab === 'scheduled' && (
        <div className={styles.scheduledList}>
          {MOCK_SCHEDULED.map(s => (
            <div key={s.id} className={styles.scheduledCard}>
              <div className={styles.scheduledIcon}>
                <span className="material-icons-round" style={{ color: s.format === 'pdf' ? '#ea4335' : '#34a853' }}>
                  {s.format === 'pdf' ? 'picture_as_pdf' : 'table_chart'}
                </span>
              </div>
              <div className={styles.scheduledBody}>
                <div className={styles.scheduledName}>{s.name}</div>
                <div className={styles.scheduledMeta}>
                  <span><span className="material-icons-round" style={{ fontSize: 13 }}>refresh</span> {s.frequency === 'weekly' ? 'Еженедельно' : 'Ежемесячно'}</span>
                  <span><span className="material-icons-round" style={{ fontSize: 13 }}>event</span> Следующий: {s.nextRun}</span>
                  <span><span className="material-icons-round" style={{ fontSize: 13 }}>{s.channel === 'email' ? 'email' : 'send'}</span> {s.channel === 'email' ? 'Email' : 'Telegram'}</span>
                  <span><span className="material-icons-round" style={{ fontSize: 13 }}>group</span> {s.recipients.join(', ')}</span>
                </div>
              </div>
              <div className={styles.scheduledActions}>
                <button className={styles.iconBtn}><span className="material-icons-round">edit</span></button>
                <button className={styles.iconBtn}><span className="material-icons-round">delete</span></button>
              </div>
            </div>
          ))}
          <button className={styles.addScheduleBtn} onClick={() => setShowSchedule(true)}>
            <span className="material-icons-round">add</span> Добавить расписание
          </button>
        </div>
      )}

      {activeTab === 'history' && (
        <div className={styles.historyList}>
          {[
            { name: 'Недельный дайджест 13-19 марта', format: 'pdf', date: '2026-03-20 11:47', size: '4.2 МБ', user: 'admin' },
            { name: 'Финансовая сводка Февраль', format: 'excel', date: '2026-03-19 18:04', size: '1.8 МБ', user: 'agronomist1' },
            { name: 'Прогноз урожая Q1 2026', format: 'pdf', date: '2026-03-15 09:30', size: '6.1 МБ', user: 'admin' },
            { name: 'Отчёт по поливу 1-15 марта', format: 'pdf', date: '2026-03-15 09:28', size: '2.4 МБ', user: 'agronomist1' },
            { name: 'Недельный дайджест 6-12 марта', format: 'pdf', date: '2026-03-13 11:00', size: '3.9 МБ', user: 'admin' },
          ].map((h, i) => (
            <div key={i} className={styles.historyItem}>
              <span className="material-icons-round" style={{ color: h.format === 'pdf' ? '#ea4335' : '#34a853', fontSize: 22 }}>
                {h.format === 'pdf' ? 'picture_as_pdf' : 'table_chart'}
              </span>
              <div className={styles.historyBody}>
                <span className={styles.historyName}>{h.name}</span>
                <span className={styles.historyMeta}>{h.date} · {h.size} · {h.user}</span>
              </div>
              <button className={styles.downloadBtn}><span className="material-icons-round">download</span></button>
            </div>
          ))}
        </div>
      )}

      {showSchedule && (
        <div className={styles.overlay} onClick={() => setShowSchedule(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div className={styles.modalTitle}><span className="material-icons-round">schedule_send</span> Новая рассылка</div>
              <button className={styles.closeBtn} onClick={() => setShowSchedule(false)}><span className="material-icons-round">close</span></button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.formGroup}><label>Шаблон отчёта</label>
                <select className={styles.select}>{TEMPLATES.map(t => <option key={t.id}>{t.name}</option>)}</select>
              </div>
              <div className={styles.formRow}>
                <div className={styles.formGroup}><label>Периодичность</label>
                  <select className={styles.select}><option>Еженедельно</option><option>Ежемесячно</option></select>
                </div>
                <div className={styles.formGroup}><label>Формат</label>
                  <select className={styles.select}><option>PDF</option><option>Excel</option></select>
                </div>
              </div>
              <div className={styles.formGroup}><label>Канал</label>
                <select className={styles.select}><option>Email</option><option>Telegram</option></select>
              </div>
              <div className={styles.formGroup}><label>Получатели (через запятую)</label>
                <input className={styles.input} placeholder="email1@agro.ru, email2@agro.ru" />
              </div>
              <div className={styles.modalActions}>
                <button className={styles.cancelBtn} onClick={() => setShowSchedule(false)}>Отмена</button>
                <button className={styles.saveBtn} onClick={() => setShowSchedule(false)}>
                  <span className="material-icons-round">save</span> Создать расписание
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ReportsPage
