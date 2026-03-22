import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppDispatch, useAppSelector } from '@application/store/hooks'
import { fetchFields, deleteField, createField } from '@application/store/slices/fieldsSlice'
import Card from '@presentation/components/common/Card/Card'
import Badge from '@presentation/components/common/Badge/Badge'
import Button from '@presentation/components/common/Button/Button'
import Input from '@presentation/components/common/Input/Input'
import Select from '@presentation/components/common/Select/Select'
import Loader from '@presentation/components/common/Loader/Loader'
import { Field, CropType, FieldStatus } from '@domain/entities/Field'
import styles from './FieldsPage.module.scss'

const cropLabels: Record<CropType, string> = {
  wheat: 'Пшеница', corn: 'Кукуруза', sunflower: 'Подсолнечник',
  barley: 'Ячмень', soy: 'Соя', sugar_beet: 'Сахарная свёкла', other: 'Другая',
}
const cropColors: Record<CropType, string> = {
  wheat: '#f59e0b', corn: '#f97316', sunflower: '#eab308',
  barley: '#84cc16', soy: '#22c55e', sugar_beet: '#ec4899', other: '#6b7280',
}
const statusConfig: Record<FieldStatus, { label: string; variant: 'success' | 'neutral' | 'info' | 'primary' }> = {
  active: { label: 'Активно', variant: 'success' },
  idle: { label: 'Простой', variant: 'neutral' },
  harvested: { label: 'Убрано', variant: 'info' },
  preparing: { label: 'Подготовка', variant: 'primary' },
}

const cropOptions = Object.entries(cropLabels).map(([v, l]) => ({ value: v, label: l }))
const statusOptions = Object.entries(statusConfig).map(([v, c]) => ({ value: v, label: c.label }))

const FieldsPage: React.FC = () => {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const { items: fields, loading } = useAppSelector(s => s.fields)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    name: '', area: '', cropType: 'wheat' as CropType, status: 'active' as FieldStatus,
    soilType: '', lat: '', lng: '', plantingDate: '',
  })

  useEffect(() => { dispatch(fetchFields()) }, [dispatch])

  const totalArea = fields.reduce((sum, f) => sum + f.area, 0)

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    const lat = Number(form.lat)
    const lng = Number(form.lng)
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
      alert('Укажите широту в диапазоне от −90 до 90.')
      return
    }
    if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
      alert('Укажите долготу в диапазоне от −180 до 180.')
      return
    }
    await dispatch(createField({
      name: form.name,
      area: Number(form.area),
      cropType: form.cropType,
      status: form.status,
      soilType: form.soilType,
      coordinates: { lat, lng },
      plantingDate: form.plantingDate || undefined,
    }))
    setShowForm(false)
    setForm({ name: '', area: '', cropType: 'wheat', status: 'active', soilType: '', lat: '', lng: '', plantingDate: '' })
  }

  if (loading && fields.length === 0) return <Loader text="Загрузка полей..." fullPage />

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Управление полями</h1>
          <p className={styles.subtitle}>
            {fields.length === 0
              ? 'У вас пока нет полей'
              : `${fields.length} полей · ${totalArea.toFixed(1)} га общая площадь`}
          </p>
        </div>
        <Button icon="add" onClick={() => setShowForm(!showForm)}>
          Добавить поле
        </Button>
      </div>

      {showForm && (
        <Card className={styles.formCard}>
          <h2 className={styles.formTitle}>Новое поле</h2>
          <form onSubmit={handleCreate} className={styles.form}>
            <div className={styles.formGrid}>
              <Input label="Название" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                placeholder="Поле №5 «Северное»" required fullWidth />
              <Input label="Площадь (га)" type="number" value={form.area} onChange={e => setForm(p => ({ ...p, area: e.target.value }))}
                placeholder="45.5" required fullWidth />
              <Select label="Культура" options={cropOptions} value={form.cropType}
                onChange={e => setForm(p => ({ ...p, cropType: e.target.value as CropType }))} fullWidth />
              <Select label="Статус" options={statusOptions} value={form.status}
                onChange={e => setForm(p => ({ ...p, status: e.target.value as FieldStatus }))} fullWidth />
              <Input label="Тип почвы" value={form.soilType} onChange={e => setForm(p => ({ ...p, soilType: e.target.value }))}
                placeholder="Чернозём" fullWidth />
              <Input label="Широта" type="number" step="any" value={form.lat} required
                onChange={e => setForm(p => ({ ...p, lat: e.target.value }))}
                placeholder="47.2357" fullWidth />
              <Input label="Долгота" type="number" step="any" value={form.lng} required
                onChange={e => setForm(p => ({ ...p, lng: e.target.value }))}
                placeholder="39.7015" fullWidth />
              <Input label="Дата посева" type="date" value={form.plantingDate}
                onChange={e => setForm(p => ({ ...p, plantingDate: e.target.value }))} fullWidth />
            </div>
            <div className={styles.formActions}>
              <Button variant="ghost" type="button" onClick={() => setShowForm(false)}>Отмена</Button>
              <Button type="submit" loading={loading}>Создать поле</Button>
            </div>
          </form>
        </Card>
      )}

      {fields.length === 0 && !showForm ? (
        <Card className={styles.emptyCard}>
          <div className={styles.emptyState}>
            <div className={styles.emptyIconWrap}>
              <span className="material-icons-round">agriculture</span>
            </div>
            <h2 className={styles.emptyTitle}>У вас пока нет полей</h2>
            <p className={styles.emptyText}>
              Создайте первое поле с площадью и координатами — откроются прогноз урожайности, рекомендации по поливу и снимки поля.
            </p>
            <Button icon="add" onClick={() => setShowForm(true)}>
              Добавить поле
            </Button>
          </div>
        </Card>
      ) : (
        <div className={styles.fieldsGrid}>
          {fields.map(field => (
            <FieldCard key={field.id} field={field}
              onView={() => navigate(`/forecast?fieldId=${field.id}`)}
              onDelete={() => dispatch(deleteField(field.id))}
            />
          ))}
        </div>
      )}
    </div>
  )
}

const FieldCard: React.FC<{ field: Field; onView: () => void; onDelete: () => void }> = ({ field, onView, onDelete }) => {
  const cfg = statusConfig[field.status]
  const color = cropColors[field.cropType]

  return (
    <Card className={styles.fieldCard} padding="none">
      <div className={styles.fieldCardAccent} style={{ background: color }} />
      <div className={styles.fieldCardBody}>
        <div className={styles.fieldCardHeader}>
          <div>
            <div className={styles.fieldCardName}>{field.name}</div>
            <div className={styles.fieldCardCrop}>
              <span className={styles.cropDot} style={{ background: color }} />
              {cropLabels[field.cropType]}
            </div>
          </div>
          <Badge variant={cfg.variant} size="sm">{cfg.label}</Badge>
        </div>

        <div className={styles.fieldCardStats}>
          <div className={styles.fieldStat}>
            <span className="material-icons-round">straighten</span>
            <div>
              <div className={styles.fieldStatValue}>{field.area} га</div>
              <div className={styles.fieldStatLabel}>Площадь</div>
            </div>
          </div>
          <div className={styles.fieldStat}>
            <span className="material-icons-round">landscape</span>
            <div>
              <div className={styles.fieldStatValue}>{field.soilType || '—'}</div>
              <div className={styles.fieldStatLabel}>Почва</div>
            </div>
          </div>
          {field.currentMoistureLevel != null && (
            <div className={styles.fieldStat}>
              <span className="material-icons-round">water</span>
              <div>
                <div className={`${styles.fieldStatValue} ${field.currentMoistureLevel < 40 ? styles.danger : field.currentMoistureLevel < 55 ? styles.warning : ''}`}>
                  {field.currentMoistureLevel}%
                </div>
                <div className={styles.fieldStatLabel}>Влажность</div>
              </div>
            </div>
          )}
          {field.plantingDate && (
            <div className={styles.fieldStat}>
              <span className="material-icons-round">calendar_today</span>
              <div>
                <div className={styles.fieldStatValue}>
                  {new Date(field.plantingDate).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
                </div>
                <div className={styles.fieldStatLabel}>Посев</div>
              </div>
            </div>
          )}
          <div className={styles.fieldStat}>
            <span className="material-icons-round">place</span>
            <div>
              <div className={styles.fieldStatValue}>
                {field.coordinates.lat.toFixed(4)}, {field.coordinates.lng.toFixed(4)}
              </div>
              <div className={styles.fieldStatLabel}>Координаты</div>
            </div>
          </div>
        </div>

        <div className={styles.fieldCardActions}>
          <Button variant="secondary" size="sm" icon="trending_up" onClick={onView}>
            Прогноз
          </Button>
          <Button variant="ghost" size="sm" icon="delete" onClick={onDelete}>
            Удалить
          </Button>
        </div>
      </div>
    </Card>
  )
}

export default FieldsPage
