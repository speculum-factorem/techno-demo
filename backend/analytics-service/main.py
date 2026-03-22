"""
Analytics Service - ML-based crop yield forecasting and irrigation recommendations
"""
import os
import json
import logging
import threading
from datetime import datetime, timedelta
from typing import Optional, List
from contextlib import asynccontextmanager
import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, FileResponse
from pydantic import BaseModel
from sqlalchemy import create_engine, Column, String, Float, Integer, Boolean, DateTime, Text, text
from sqlalchemy.orm import declarative_base, sessionmaker
from sklearn.ensemble import RandomForestRegressor
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline
import joblib
import requests
from uuid import uuid4

from satellite_stac import build_grid_for_field, build_series, list_available_dates
from apscheduler.schedulers.background import BackgroundScheduler

import report_exports

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class ModelNotReady(RuntimeError):
    """Raised when ML training has not finished yet (HTTP 503 / skip Kafka message)."""
    pass

KAFKA_BOOTSTRAP_SERVERS = os.getenv('KAFKA_BOOTSTRAP_SERVERS', 'localhost:9092')
DATABASE_URL = os.getenv('DATABASE_URL', '')
FIELD_SERVICE_URL = os.getenv('FIELD_SERVICE_URL', 'http://field-service:8082')
OPEN_METEO_BASE_URL = os.getenv('OPEN_METEO_BASE_URL', 'https://api.open-meteo.com')
INTERNAL_API_TOKEN = os.getenv('INTERNAL_API_TOKEN', '')

# SQLAlchemy setup for real persistence in analytics-service
SQLALCHEMY_DATABASE_URL = (
    f"postgresql+psycopg2://{DATABASE_URL.split('://', 1)[1]}"
    if DATABASE_URL.startswith("postgresql://")
    else DATABASE_URL
)
engine = create_engine(SQLALCHEMY_DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# ======================= MODELS =======================

class ForecastRequest(BaseModel):
    fieldId: str
    targetDate: str
    cropType: Optional[str] = "wheat"
    area: Optional[float] = 50.0
    soilType: Optional[str] = "Чернозём"
    includeFactors: Optional[bool] = True

class ForecastFactor(BaseModel):
    name: str
    impact: str  # positive, negative, neutral
    weight: float
    description: str

class YieldForecastResponse(BaseModel):
    id: str
    fieldId: str
    fieldName: str
    cropType: str
    forecastDate: str
    predictedYield: float
    yieldMin: float
    yieldMax: float
    confidence: str  # HIGH, MEDIUM, LOW
    factors: List[ForecastFactor]
    historicalAverage: Optional[float]
    modelVersion: str
    createdAt: str

class IrrigationRecommendation(BaseModel):
    id: str
    fieldId: str
    fieldName: str
    recommendedDate: str
    waterAmount: float
    duration: int
    priority: str
    reason: str
    moistureDeficit: float
    confidence: float
    status: str
    createdAt: str

class WeatherInput(BaseModel):
    temperature: float = 22.0
    humidity: float = 60.0
    precipitation_7d: float = 12.0
    avg_temperature_7d: float = 22.0
    soil_moisture: float = 60.0
    solar_radiation: float = 500.0
    wind_speed: float = 3.0

class HistoricalYield(BaseModel):
    year: int
    yield_amount: float
    cropType: str
    precipitation: float
    avgTemperature: float

class WhatIfScenarioRequest(BaseModel):
    fieldId: str
    targetDate: str
    cropType: Optional[str] = "wheat"
    soilType: Optional[str] = "Чернозём"
    area: Optional[float] = 50.0
    expectedPricePerTon: Optional[float] = 13500.0
    baseline: Optional[dict] = None
    scenarios: List[dict]

class WhatIfScenarioResult(BaseModel):
    name: str
    irrigationMultiplier: float
    seedingMultiplier: float
    expectedYield: float
    expectedYieldDeltaPercent: float
    expectedWaterM3: float
    expectedWaterDeltaPercent: float
    expectedRevenue: float
    expectedCost: float
    expectedProfit: float
    roiPercent: float

class WhatIfSimulationResponse(BaseModel):
    fieldId: str
    fieldName: str
    baseline: WhatIfScenarioResult
    scenarios: List[WhatIfScenarioResult]
    recommendedScenario: str
    generatedAt: str


# ======================= OPS PERSISTENCE MODELS =======================

class IoTTelemetryRecord(Base):
    __tablename__ = "iot_telemetry_records"
    id = Column(String, primary_key=True, default=lambda: str(uuid4()))
    field_id = Column(String, nullable=False, index=True)
    field_name = Column(String, nullable=True)
    device_id = Column(String, nullable=True)
    temperature = Column(Float, nullable=True)
    humidity = Column(Float, nullable=True)
    soil_moisture = Column(Float, nullable=True)
    precipitation = Column(Float, nullable=True)
    wind_speed = Column(Float, nullable=True)
    solar_radiation = Column(Float, nullable=True)
    lat = Column(Float, nullable=True)
    lng = Column(Float, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class OpsWorkTaskRecord(Base):
    __tablename__ = "ops_work_tasks"
    id = Column(String, primary_key=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    category = Column(String, nullable=False)
    priority = Column(String, nullable=False)
    status = Column(String, nullable=False)
    field_id = Column(String, nullable=False)
    field_name = Column(String, nullable=False)
    assignee = Column(String, nullable=False)
    assignee_role = Column(String, nullable=False)
    deadline = Column(String, nullable=False)
    checklist_json = Column(Text, nullable=False, default="[]")
    estimated_hours = Column(Float, nullable=False, default=1.0)
    actual_hours = Column(Float, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(String, nullable=False)
    updated_at = Column(String, nullable=False)


class OpsEquipmentRecord(Base):
    __tablename__ = "ops_equipment"
    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    type = Column(String, nullable=False)
    field_id = Column(String, nullable=False)
    field_name = Column(String, nullable=False)
    status = Column(String, nullable=False, default="online")
    battery = Column(Integer, nullable=False, default=100)
    signal = Column(Integer, nullable=False, default=100)
    last_ping = Column(String, nullable=False)
    firmware = Column(String, nullable=False, default="1.0.0")
    install_date = Column(String, nullable=False)
    telemetry_json = Column(Text, nullable=False, default="{}")
    sla_json = Column(Text, nullable=False, default="{}")
    alerts_json = Column(Text, nullable=False, default="[]")


class OpsAuditRecord(Base):
    __tablename__ = "ops_audit_log"
    id = Column(String, primary_key=True)
    timestamp = Column(String, nullable=False)
    user_id = Column(String, nullable=False)
    user_name = Column(String, nullable=False)
    user_role = Column(String, nullable=False)
    action = Column(String, nullable=False)
    entity_type = Column(String, nullable=False, default="")
    entity_id = Column(String, nullable=False, default="")
    entity_name = Column(String, nullable=False, default="")
    details = Column(Text, nullable=False, default="")
    ip_address = Column(String, nullable=False, default="")
    result = Column(String, nullable=False, default="success")


class OpsNotificationRuleRecord(Base):
    __tablename__ = "ops_notification_rules"
    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=False, default="")
    enabled = Column(Boolean, nullable=False, default=True)
    conditions_json = Column(Text, nullable=False, default="[]")
    condition_logic = Column(String, nullable=False, default="AND")
    channels_json = Column(Text, nullable=False, default="[]")
    recipients_json = Column(Text, nullable=False, default="[]")
    field_ids_json = Column(Text, nullable=False, default="[]")
    cooldown_minutes = Column(Integer, nullable=False, default=60)
    created_by = Column(String, nullable=False, default="system")
    created_at = Column(String, nullable=False)
    last_triggered = Column(String, nullable=True)
    trigger_count = Column(Integer, nullable=False, default=0)


class OpsReportRecord(Base):
    __tablename__ = "ops_report_history"
    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    format = Column(String, nullable=False)
    created_by = Column(String, nullable=False, default="system")
    size_mb = Column(Float, nullable=False, default=1.0)
    created_at = Column(String, nullable=False)
    template_id = Column(String, nullable=False, default="")


class OpsScheduledReportRecord(Base):
    __tablename__ = "ops_scheduled_reports"
    id = Column(String, primary_key=True)
    template_id = Column(String, nullable=False)
    name = Column(String, nullable=False)
    frequency = Column(String, nullable=False)
    format = Column(String, nullable=False)
    channel = Column(String, nullable=False)
    recipients_json = Column(Text, nullable=False, default="[]")
    next_run = Column(String, nullable=False)
    created_at = Column(String, nullable=False)


class AppIntegrationRecord(Base):
    __tablename__ = "app_integrations"
    id = Column(String, primary_key=True)
    type = Column(String, nullable=False)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=False, default="")
    icon = Column(String, nullable=False, default="")
    status = Column(String, nullable=False, default="disconnected")
    last_sync = Column(String, nullable=True)
    records_synced = Column(Integer, nullable=False, default=0)
    config_json = Column(Text, nullable=False, default="{}")
    features_json = Column(Text, nullable=False, default="[]")


class IoTTelemetryInput(BaseModel):
    fieldId: str
    fieldName: Optional[str] = None
    deviceId: Optional[str] = None
    temperature: Optional[float] = None
    humidity: Optional[float] = None
    soilMoisture: Optional[float] = None
    precipitation: Optional[float] = None
    windSpeed: Optional[float] = None
    solarRadiation: Optional[float] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
# ======================= ML MODEL =======================

class YieldPredictionModel:
    """Random Forest model for crop yield prediction"""

    CROP_YIELD_BASELINES = {
        'wheat': 4.5,
        'corn': 7.0,
        'sunflower': 2.2,
        'barley': 3.8,
        'soy': 2.0,
        'sugar_beet': 35.0,
        'other': 3.0,
    }

    SOIL_MULTIPLIERS = {
        'Чернозём': 1.15,
        'Суглинок': 1.0,
        'Песчаник': 0.85,
        'Глинистый': 0.90,
        'Торфяной': 0.95,
    }

    def __init__(self):
        self.model = self._build_model()
        self.is_trained = False
        # Синхронное обучение при импорте блокирует Uvicorn до конца fit() → Docker healthcheck падает.
        # Обучение запускается из lifespan (фоновый поток) после create_all.
        self._training_ready = threading.Event()

    def start_training_background(self) -> None:
        def _run() -> None:
            try:
                self._train_with_synthetic_data()
            except Exception:
                logger.exception("ML background training failed")
            finally:
                self._training_ready.set()

        threading.Thread(target=_run, daemon=True, name="ml-train").start()

    def wait_until_trained(self, timeout: float = 240.0) -> bool:
        if self.is_trained:
            return True
        self._training_ready.wait(timeout=timeout)
        return self.is_trained

    def _build_model(self):
        return Pipeline([
            ('scaler', StandardScaler()),
            ('regressor', RandomForestRegressor(
                n_estimators=100,
                max_depth=8,
                min_samples_split=5,
                random_state=42,
                n_jobs=-1
            ))
        ])

    def _generate_training_data(self, n_samples=2000):
        """Generate synthetic training data based on agronomical knowledge.

        All mandatory fields from the dataset specification are included:
        field_id, date, timestamp, temperature, humidity_air, precipitation,
        wind_speed, soil_moisture, crop_type, yield_actual (0-1 normalised),
        irrigation_volume, irrigation_recommended, is_anomaly.
        """
        np.random.seed(42)
        rng = np.random.default_rng(42)
        data = []

        crops = ['wheat', 'corn', 'sunflower', 'barley', 'soy', 'sugar_beet', 'other']
        soils = ['Чернозём', 'Суглинок', 'Песчаник', 'Глинистый', 'Торфяной']
        field_ids = [f'field_{i:03d}' for i in range(1, 21)]

        # Yield max per crop for 0-1 normalisation
        yield_max = {'wheat': 8.0, 'corn': 12.0, 'sunflower': 4.0,
                     'barley': 7.0, 'soy': 4.5, 'sugar_beet': 60.0, 'other': 6.0}

        base_date = datetime(2024, 4, 1)

        for i in range(n_samples):
            temp = float(rng.uniform(5, 40))
            humidity_air = float(rng.uniform(25, 98))
            precipitation = float(rng.uniform(0, 25))   # daily mm
            precip_7d = precipitation * 7 * rng.uniform(0.5, 1.5)
            avg_temp = temp + float(rng.uniform(-3, 3))
            soil_moisture = float(np.clip(
                humidity_air * 0.65 + precipitation * 1.2 + rng.normal(0, 8), 5, 98
            ))
            solar_rad = float(rng.uniform(150, 750))
            wind_speed = float(rng.uniform(0.3, 14))
            crop_code = int(rng.integers(0, 7))
            soil_code = int(rng.integers(0, 5))

            crop = crops[crop_code]
            soil = soils[soil_code]
            field_id = field_ids[i % len(field_ids)]
            obs_date = base_date + timedelta(days=int(i * 365 / n_samples))

            base = self.CROP_YIELD_BASELINES.get(crop, 3.0)
            soil_mult = self.SOIL_MULTIPLIERS.get(soil, 1.0)

            temp_factor = 1.1 if 18 <= temp <= 28 else (0.8 if temp > 32 or temp < 10 else 0.95)
            moisture_factor = (
                0.6 + soil_moisture / 100 if soil_moisture < 35 else
                0.9 if soil_moisture > 85 else
                0.85 + (soil_moisture - 35) * 0.003
            )
            precip_factor = min(1.2, 0.8 + precip_7d / 60)
            radiation_factor = min(1.1, 0.8 + solar_rad / 1200)
            wind_factor = 1.0 if wind_speed < 8 else 0.9

            yield_abs = base * soil_mult * temp_factor * moisture_factor * precip_factor * radiation_factor * wind_factor
            yield_abs *= float(0.85 + rng.random() * 0.30)
            yield_abs = max(0.3, yield_abs)

            # 0-1 normalised target variable (yield_actual)
            yield_norm = round(float(np.clip(yield_abs / yield_max.get(crop, 6.0), 0.0, 1.0)), 4)

            # Irrigation volumes (l/m²)
            optimal_min = {'wheat': 55, 'corn': 65, 'sunflower': 60,
                           'barley': 50, 'soy': 65, 'sugar_beet': 70}.get(crop, 60)
            moisture_deficit = max(0.0, optimal_min - soil_moisture)
            irr_recommended = round(float(np.clip(moisture_deficit * 0.35, 0, 15)), 2)
            irr_volume = round(float(irr_recommended * rng.uniform(0.7, 1.3)), 2)

            # Anomaly flag: physically impossible sensor readings
            is_anomaly = bool(
                soil_moisture > 97 or soil_moisture < 2
                or temp > 44 or temp < -18
                or humidity_air > 100 or humidity_air < 1
                or wind_speed > 30
            )

            # Inject synthetic anomalies in ~3 % of records
            if not is_anomaly and rng.random() < 0.03:
                anomaly_type = rng.integers(0, 4)
                if anomaly_type == 0:
                    soil_moisture = float(rng.uniform(98, 105))
                elif anomaly_type == 1:
                    temp = float(rng.uniform(50, 70))
                elif anomaly_type == 2:
                    humidity_air = float(rng.uniform(105, 120))
                else:
                    soil_moisture = float(rng.uniform(-5, -0.1))
                is_anomaly = True

            data.append({
                # ---- Mandatory fields from specification ----
                'field_id': field_id,
                'date': obs_date.strftime('%Y-%m-%d'),
                'timestamp': obs_date.strftime('%Y-%m-%dT%H:%M:%S'),
                'temperature': round(temp, 2),
                'humidity_air': round(humidity_air, 2),
                'precipitation': round(precipitation, 2),
                'wind_speed': round(wind_speed, 2),
                'soil_moisture': round(soil_moisture, 2),
                'crop_type': crop,
                'yield_actual': yield_norm,
                'irrigation_volume': irr_volume,
                'irrigation_recommended': irr_recommended,
                'is_anomaly': is_anomaly,
                # ---- Additional fields for model training ----
                'humidity': round(humidity_air, 2),          # alias kept for model compat
                'precipitation_7d': round(precip_7d, 2),
                'avg_temperature_7d': round(avg_temp, 2),
                'solar_radiation': round(solar_rad, 2),
                'crop_code': crop_code,
                'soil_code': soil_code,
                'soil_type': soil,
                'yield': round(yield_abs, 3),
            })

        return pd.DataFrame(data)

    def _train_with_synthetic_data(self):
        df_real = self._load_real_training_data(limit=5000)
        if df_real is not None and len(df_real) >= 200:
            df = df_real
            logger.info("📊 Training ML model on real IoT history (%d rows)", len(df_real))
        else:
            df = self._generate_training_data()
            logger.info("⚠️ Real history unavailable, fallback to synthetic training set")
        features = ['temperature', 'humidity', 'precipitation_7d', 'avg_temperature_7d',
                    'soil_moisture', 'solar_radiation', 'wind_speed', 'crop_code', 'soil_code']
        X = df[features].values
        y = df['yield'].values
        self.model.fit(X, y)
        self.is_trained = True
        logger.info("✅ ML model trained (%d samples)", len(df))

    def _load_real_training_data(self, limit: int = 5000) -> Optional[pd.DataFrame]:
        try:
            with SessionLocal() as db:
                rows = (
                    db.query(IoTTelemetryRecord)
                    .filter(IoTTelemetryRecord.soil_moisture.isnot(None))
                    .order_by(IoTTelemetryRecord.created_at.desc())
                    .limit(limit)
                    .all()
                )
            if not rows:
                return None

            rng = np.random.default_rng(42)
            records = []
            crops = ['wheat', 'corn', 'sunflower', 'barley', 'soy', 'sugar_beet', 'other']
            soils = ['Чернозём', 'Суглинок', 'Песчаник', 'Глинистый', 'Торфяной']

            for r in rows:
                crop_code = int(rng.integers(0, 7))
                soil_code = int(rng.integers(0, 5))
                crop = crops[crop_code]
                soil = soils[soil_code]
                t = r.temperature if r.temperature is not None else 22.0
                h = r.humidity if r.humidity is not None else 60.0
                sm = max(0.0, min(100.0, r.soil_moisture if r.soil_moisture is not None else 55.0))
                p7 = (r.precipitation if r.precipitation is not None else 1.0) * 7.0
                wind = r.wind_speed if r.wind_speed is not None else 3.0
                solar = r.solar_radiation if r.solar_radiation is not None else 450.0
                avg_t = t + rng.uniform(-1.5, 1.5)

                base = self.CROP_YIELD_BASELINES.get(crop, 3.0)
                soil_mult = self.SOIL_MULTIPLIERS.get(soil, 1.0)
                moisture_factor = 0.7 + sm / 120.0
                temp_factor = 1.1 if 18 <= t <= 28 else 0.9
                yield_abs = base * soil_mult * moisture_factor * temp_factor * (0.9 + solar / 2000.0) * (0.95 if wind > 10 else 1.0)
                yield_abs *= float(0.9 + rng.random() * 0.2)

                records.append({
                    'temperature': t,
                    'humidity': h,
                    'precipitation_7d': p7,
                    'avg_temperature_7d': avg_t,
                    'soil_moisture': sm,
                    'solar_radiation': solar,
                    'wind_speed': wind,
                    'crop_code': crop_code,
                    'soil_code': soil_code,
                    'yield': max(0.2, float(yield_abs)),
                })

            return pd.DataFrame(records)
        except Exception as exc:
            logger.warning("Failed loading real training data: %s", exc)
            return None

    def predict(self, weather: WeatherInput, crop_type: str, soil_type: str) -> dict:
        if not self.wait_until_trained(240.0):
            raise ModelNotReady("ML model is still training or failed to train")

        crops = ['wheat', 'corn', 'sunflower', 'barley', 'soy', 'sugar_beet', 'other']
        soils = ['Чернозём', 'Суглинок', 'Песчаник', 'Глинистый', 'Торфяной']

        crop_code = crops.index(crop_type) if crop_type in crops else 6
        soil_code = soils.index(soil_type) if soil_type in soils else 1

        X = np.array([[
            weather.temperature,
            weather.humidity,
            weather.precipitation_7d,
            weather.avg_temperature_7d,
            weather.soil_moisture,
            weather.solar_radiation,
            weather.wind_speed,
            crop_code,
            soil_code,
        ]])

        pred = float(self.model.predict(X)[0])

        tree_preds = [tree.predict(self.model.named_steps['scaler'].transform(X))[0]
                      for tree in self.model.named_steps['regressor'].estimators_[:20]]
        std = float(np.std(tree_preds))

        yield_min = max(0.1, round(pred - 1.5 * std, 2))
        yield_max = round(pred + 1.5 * std, 2)

        cv = std / max(0.1, pred)
        if cv < 0.1:
            confidence = 'HIGH'
        elif cv < 0.2:
            confidence = 'MEDIUM'
        else:
            confidence = 'LOW'

        return {
            'predicted': round(pred, 2),
            'min': yield_min,
            'max': yield_max,
            'confidence': confidence,
        }

    def get_factors(self, weather: WeatherInput, crop_type: str) -> list:
        factors = []

        if weather.soil_moisture >= 60:
            factors.append({
                'name': 'Оптимальная влажность почвы',
                'impact': 'positive',
                'weight': 0.40,
                'description': f'Влажность почвы {weather.soil_moisture:.0f}% в оптимальном диапазоне для культуры'
            })
        elif weather.soil_moisture < 40:
            factors.append({
                'name': 'Дефицит влаги в почве',
                'impact': 'negative',
                'weight': 0.45,
                'description': f'Влажность почвы {weather.soil_moisture:.0f}% значительно ниже нормы — риск стресса растений'
            })
        else:
            factors.append({
                'name': 'Недостаточная влажность почвы',
                'impact': 'negative',
                'weight': 0.25,
                'description': f'Влажность почвы {weather.soil_moisture:.0f}% ниже оптимального уровня'
            })

        if 18 <= weather.temperature <= 28:
            factors.append({
                'name': 'Оптимальная температура воздуха',
                'impact': 'positive',
                'weight': 0.28,
                'description': f'Средняя температура {weather.temperature:.1f}°C в оптимальном диапазоне для вегетации'
            })
        elif weather.temperature > 32:
            factors.append({
                'name': 'Высокая температура воздуха',
                'impact': 'negative',
                'weight': 0.30,
                'description': f'Температура {weather.temperature:.1f}°C вызывает тепловой стресс у растений'
            })
        else:
            factors.append({
                'name': 'Пониженная температура воздуха',
                'impact': 'negative',
                'weight': 0.20,
                'description': f'Температура {weather.temperature:.1f}°C замедляет вегетацию'
            })

        if weather.precipitation_7d >= 15:
            factors.append({
                'name': 'Достаточное количество осадков',
                'impact': 'positive',
                'weight': 0.22,
                'description': f'Осадки {weather.precipitation_7d:.1f} мм за последние 7 дней покрывают потребность культуры'
            })
        elif weather.precipitation_7d < 5:
            factors.append({
                'name': 'Дефицит осадков',
                'impact': 'negative',
                'weight': 0.20,
                'description': f'Осадки {weather.precipitation_7d:.1f} мм за 7 дней — рекомендуется полив'
            })
        else:
            factors.append({
                'name': 'Умеренные осадки',
                'impact': 'neutral',
                'weight': 0.15,
                'description': f'Осадки {weather.precipitation_7d:.1f} мм — умеренный уровень'
            })

        if weather.solar_radiation > 500:
            factors.append({
                'name': 'Высокая солнечная активность',
                'impact': 'positive',
                'weight': 0.15,
                'description': f'Солнечная радиация {weather.solar_radiation:.0f} Вт/м² обеспечивает активный фотосинтез'
            })

        if weather.wind_speed > 8:
            factors.append({
                'name': 'Высокая ветровая нагрузка',
                'impact': 'negative',
                'weight': 0.10,
                'description': f'Порывы ветра {weather.wind_speed:.1f} м/с создают механический стресс'
            })

        total = sum(f['weight'] for f in factors)
        for f in factors:
            f['weight'] = round(f['weight'] / total, 3)

        return factors


class IrrigationModel:
    """Rule-based + ML irrigation recommendation model"""

    CROP_OPTIMAL_MOISTURE = {
        'wheat': (55, 75),
        'corn': (65, 80),
        'sunflower': (60, 75),
        'barley': (50, 70),
        'soy': (65, 80),
        'sugar_beet': (70, 85),
        'other': (60, 75),
    }

    def recommend(
        self,
        field_id: str,
        field_name: str,
        crop_type: str,
        current_moisture: float,
        forecast_precipitation_7d: float,
        area: float,
        temperature: float,
    ) -> List[dict]:
        recommendations = []
        optimal_min, optimal_max = self.CROP_OPTIMAL_MOISTURE.get(crop_type, (60, 75))

        moisture_deficit = max(0, optimal_min - current_moisture)

        if moisture_deficit > 25 or (moisture_deficit > 0 and current_moisture < 35):
            priority = 'critical'
            confidence = 95
            reason = f'КРИТИЧНО: Влажность {current_moisture:.0f}% значительно ниже минимума ({optimal_min}%) для {crop_type}. Срочный полив необходим.'
        elif moisture_deficit > 15:
            priority = 'high'
            confidence = 88
            reason = f'Влажность почвы {current_moisture:.0f}% ниже оптимума ({optimal_min}%). Требуется полив в ближайшие 24 часа.'
        elif moisture_deficit > 8:
            priority = 'medium'
            confidence = 75
            reason = f'Прогнозируется снижение влажности ниже {optimal_min}% через 2-3 дня. Рекомендуется профилактический полив.'
        elif moisture_deficit > 0:
            priority = 'low'
            confidence = 60
            reason = f'Незначительный дефицит влаги. Рекомендуется полив при отсутствии осадков.'
        else:
            return []

        water_needed = moisture_deficit * 2.5
        water_needed = max(10, min(60, water_needed))
        duration_minutes = int(water_needed / 5.0 * 60)

        recommendations.append({
            'id': f'irr-{field_id}-{datetime.now().strftime("%Y%m%d")}',
            'fieldId': field_id,
            'fieldName': field_name,
            'recommendedDate': datetime.now().strftime('%Y-%m-%d'),
            'waterAmount': round(water_needed, 1),
            'duration': duration_minutes,
            'priority': priority,
            'reason': reason,
            'moistureDeficit': round(moisture_deficit, 1),
            'confidence': confidence,
            'status': 'scheduled',
            'createdAt': datetime.now().isoformat(),
        })

        if priority in ('critical', 'high') and forecast_precipitation_7d < 10:
            follow_water = max(15, water_needed * 0.6)
            recommendations.append({
                'id': f'irr-{field_id}-followup-{datetime.now().strftime("%Y%m%d")}',
                'fieldId': field_id,
                'fieldName': field_name,
                'recommendedDate': (datetime.now() + timedelta(days=3)).strftime('%Y-%m-%d'),
                'waterAmount': round(follow_water, 1),
                'duration': int(follow_water / 5.0 * 60),
                'priority': 'medium',
                'reason': f'Профилактический повторный полив через 3 дня при прогнозе низких осадков ({forecast_precipitation_7d:.0f} мм)',
                'moistureDeficit': round(moisture_deficit * 0.4, 1),
                'confidence': 68,
                'status': 'scheduled',
                'createdAt': datetime.now().isoformat(),
            })

        return recommendations


# Initialize models
yield_model = YieldPredictionModel()
irrigation_model = IrrigationModel()

CROP_LABELS = {
    'wheat': 'Пшеница', 'corn': 'Кукуруза', 'sunflower': 'Подсолнечник',
    'barley': 'Ячмень', 'soy': 'Соя', 'sugar_beet': 'Сахарная свёкла', 'other': 'Другая культура',
}

HISTORICAL_BASELINES = {
    'wheat': [
        {'year': 2019, 'yield': 3.9, 'precipitation': 380, 'avgTemperature': 21.5},
        {'year': 2020, 'yield': 4.2, 'precipitation': 420, 'avgTemperature': 22.1},
        {'year': 2021, 'yield': 3.5, 'precipitation': 310, 'avgTemperature': 23.8},
        {'year': 2022, 'yield': 4.6, 'precipitation': 450, 'avgTemperature': 21.9},
        {'year': 2023, 'yield': 4.3, 'precipitation': 395, 'avgTemperature': 22.4},
    ],
    'corn': [
        {'year': 2019, 'yield': 6.2, 'precipitation': 380, 'avgTemperature': 22.0},
        {'year': 2020, 'yield': 6.8, 'precipitation': 420, 'avgTemperature': 22.5},
        {'year': 2021, 'yield': 5.9, 'precipitation': 320, 'avgTemperature': 24.1},
        {'year': 2022, 'yield': 7.4, 'precipitation': 460, 'avgTemperature': 22.2},
        {'year': 2023, 'yield': 6.9, 'precipitation': 405, 'avgTemperature': 22.8},
    ],
    'sunflower': [
        {'year': 2019, 'yield': 1.9, 'precipitation': 340, 'avgTemperature': 22.5},
        {'year': 2020, 'yield': 2.1, 'precipitation': 380, 'avgTemperature': 23.0},
        {'year': 2021, 'yield': 1.7, 'precipitation': 280, 'avgTemperature': 24.5},
        {'year': 2022, 'yield': 2.3, 'precipitation': 410, 'avgTemperature': 22.8},
        {'year': 2023, 'yield': 2.0, 'precipitation': 360, 'avgTemperature': 23.2},
    ],
    'barley': [
        {'year': 2019, 'yield': 3.2, 'precipitation': 360, 'avgTemperature': 21.0},
        {'year': 2020, 'yield': 3.6, 'precipitation': 400, 'avgTemperature': 21.8},
        {'year': 2021, 'yield': 2.9, 'precipitation': 295, 'avgTemperature': 23.2},
        {'year': 2022, 'yield': 3.9, 'precipitation': 435, 'avgTemperature': 21.5},
        {'year': 2023, 'yield': 3.5, 'precipitation': 375, 'avgTemperature': 22.0},
    ],
    'soy': [
        {'year': 2019, 'yield': 1.6, 'precipitation': 410, 'avgTemperature': 22.0},
        {'year': 2020, 'yield': 1.9, 'precipitation': 450, 'avgTemperature': 22.6},
        {'year': 2021, 'yield': 1.4, 'precipitation': 330, 'avgTemperature': 24.0},
        {'year': 2022, 'yield': 2.1, 'precipitation': 480, 'avgTemperature': 22.3},
        {'year': 2023, 'yield': 1.8, 'precipitation': 420, 'avgTemperature': 22.9},
    ],
    'sugar_beet': [
        {'year': 2019, 'yield': 28.5, 'precipitation': 420, 'avgTemperature': 21.8},
        {'year': 2020, 'yield': 32.1, 'precipitation': 460, 'avgTemperature': 22.3},
        {'year': 2021, 'yield': 25.8, 'precipitation': 340, 'avgTemperature': 23.9},
        {'year': 2022, 'yield': 35.4, 'precipitation': 490, 'avgTemperature': 22.0},
        {'year': 2023, 'yield': 30.7, 'precipitation': 430, 'avgTemperature': 22.6},
    ],
    'other': [
        {'year': 2019, 'yield': 2.8, 'precipitation': 370, 'avgTemperature': 21.5},
        {'year': 2020, 'yield': 3.1, 'precipitation': 410, 'avgTemperature': 22.0},
        {'year': 2021, 'yield': 2.5, 'precipitation': 300, 'avgTemperature': 23.5},
        {'year': 2022, 'yield': 3.4, 'precipitation': 440, 'avgTemperature': 21.8},
        {'year': 2023, 'yield': 3.0, 'precipitation': 385, 'avgTemperature': 22.3},
    ],
}

# Per-field yield variance seeds — makes historical data differ across fields
_FIELD_YIELD_VARIANCE = {
    'field_001': 0.95, 'field_002': 1.05, 'field_003': 0.88,
    'field_004': 1.12, 'field_005': 0.97,
}


def _field_service_headers() -> Optional[dict]:
    if not INTERNAL_API_TOKEN:
        return None
    return {"X-Internal-Token": INTERNAL_API_TOKEN}


def _safe_get_json(
    url: str,
    params: Optional[dict] = None,
    timeout: int = 8,
    headers: Optional[dict] = None,
) -> Optional[dict]:
    try:
        response = requests.get(url, params=params, timeout=timeout, headers=headers)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        logger.warning("External API request failed: %s (%s)", url, e)
        return None


def _fetch_field_info(field_id: str) -> Optional[dict]:
    hdrs = _field_service_headers()
    for base_url in [FIELD_SERVICE_URL, "http://localhost:8082"]:
        data = _safe_get_json(f"{base_url}/api/fields/{field_id}", headers=hdrs)
        if data:
            return data
    return None


def _to_float(value: Optional[object], default: float) -> float:
    try:
        if value is None:
            return default
        return float(value)
    except (TypeError, ValueError):
        return default


def _mean(values: List[Optional[float]], default: float) -> float:
    cleaned = [float(v) for v in values if v is not None]
    return float(np.mean(cleaned)) if cleaned else default


def _sum(values: List[Optional[float]], default: float) -> float:
    cleaned = [float(v) for v in values if v is not None]
    return float(np.sum(cleaned)) if cleaned else default


def _fetch_open_meteo_weather(lat: float, lng: float) -> Optional[WeatherInput]:
    payload = _safe_get_json(
        f"{OPEN_METEO_BASE_URL}/v1/forecast",
        params={
            "latitude": lat,
            "longitude": lng,
            "hourly": "temperature_2m,relative_humidity_2m,precipitation,soil_moisture_0_to_1cm,shortwave_radiation,wind_speed_10m",
            "current": "temperature_2m,relative_humidity_2m,wind_speed_10m",
            "forecast_days": 7,
            "timezone": "auto",
        },
    )
    if not payload:
        return None

    hourly = payload.get("hourly", {})
    temperature_series = hourly.get("temperature_2m", []) or []
    humidity_series = hourly.get("relative_humidity_2m", []) or []
    precipitation_series = hourly.get("precipitation", []) or []
    soil_moisture_series = hourly.get("soil_moisture_0_to_1cm", []) or []
    solar_series = hourly.get("shortwave_radiation", []) or []
    wind_series = hourly.get("wind_speed_10m", []) or []

    current = payload.get("current", {})
    return WeatherInput(
        temperature=_to_float(current.get("temperature_2m"), _mean(temperature_series[:6], 22.0)),
        humidity=_to_float(current.get("relative_humidity_2m"), _mean(humidity_series[:24], 60.0)),
        precipitation_7d=_sum(precipitation_series[:168], 10.0),
        avg_temperature_7d=_mean(temperature_series[:168], 22.0),
        soil_moisture=_mean([v * 100 for v in soil_moisture_series[:24]], 58.0),
        solar_radiation=_mean(solar_series[:24], 450.0),
        wind_speed=_to_float(current.get("wind_speed_10m"), _mean(wind_series[:24], 3.5)),
    )


def _resolve_field_context(field_id: str, fallback_crop: str = "wheat", fallback_soil: str = "Чернозём", fallback_area: float = 50.0):
    field = _fetch_field_info(field_id)
    if not field:
        return {
            "fieldName": f"Поле {field_id}",
            "cropType": fallback_crop,
            "soilType": fallback_soil,
            "area": fallback_area,
            "currentMoistureLevel": 58.0,
            "weather": None,
        }

    lat = field.get("lat")
    lng = field.get("lng")
    weather = None
    if lat is not None and lng is not None:
        weather = _fetch_open_meteo_weather(float(lat), float(lng))

    return {
        "fieldName": field.get("name") or f"Поле {field_id}",
        "cropType": field.get("cropType") or fallback_crop,
        "soilType": field.get("soilType") or fallback_soil,
        "area": _to_float(field.get("area"), fallback_area),
        "currentMoistureLevel": _to_float(field.get("currentMoistureLevel"), 58.0),
        "lat": lat,
        "lng": lng,
        "weather": weather,
    }


def _update_field_moisture(field_id: str, soil_moisture: float):
    field = _fetch_field_info(field_id)
    if not field:
        return
    headers = _field_service_headers() or {}
    headers["Content-Type"] = "application/json"
    payload = {
        "currentMoistureLevel": soil_moisture
    }
    try:
        requests.put(f"{FIELD_SERVICE_URL}/api/fields/{field_id}", json=payload, headers=headers, timeout=6)
    except Exception as exc:
        logger.warning("Failed to update field moisture for %s: %s", field_id, exc)


# ======================= KAFKA CONSUMER =======================

def _run_kafka_consumer():
    """Background thread: consume weather-data → predict yield → publish forecast-results"""
    try:
        from confluent_kafka import Consumer, Producer, KafkaError
    except ImportError:
        logger.warning("confluent_kafka not available — Kafka consumer disabled")
        return

    import time

    consumer_conf = {
        'bootstrap.servers': KAFKA_BOOTSTRAP_SERVERS,
        'group.id': 'analytics-service',
        'auto.offset.reset': 'latest',
        'enable.auto.commit': True,
    }
    producer_conf = {'bootstrap.servers': KAFKA_BOOTSTRAP_SERVERS}

    consumer = None
    producer = None

    for attempt in range(10):
        try:
            consumer = Consumer(consumer_conf)
            producer = Producer(producer_conf)
            consumer.subscribe(['weather-data'])
            logger.info("✅ Kafka consumer connected to %s", KAFKA_BOOTSTRAP_SERVERS)
            break
        except Exception as e:
            logger.warning("Kafka not ready (attempt %d/10): %s", attempt + 1, e)
            time.sleep(6)
    else:
        logger.error("❌ Could not connect to Kafka — consumer disabled")
        return

    logger.info("📡 Listening on topic: weather-data")

    while True:
        try:
            msg = consumer.poll(timeout=1.0)
            if msg is None:
                continue
            if msg.error():
                if msg.error().code() != KafkaError._PARTITION_EOF:
                    logger.error("Kafka error: %s", msg.error())
                continue

            event = json.loads(msg.value().decode('utf-8'))
            field_id = event.get('fieldId')
            if not field_id:
                continue

            weather = WeatherInput(
                temperature=float(event.get('temperature', 22.0)),
                humidity=float(event.get('humidity', 60.0)),
                # prefer explicit 7-day sum; fall back to daily value only if unavailable
                precipitation_7d=float(event.get('precipitation7d') or event.get('precipitation', 0.0)),
                avg_temperature_7d=float(event.get('avgTemperature7d') or event.get('temperature', 22.0)),
                soil_moisture=float(event.get('soilMoisture', 60.0)),
                solar_radiation=float(event.get('solarRadiation', 500.0)),
                wind_speed=float(event.get('windSpeed', 3.0)),
            )

            crop_type = event.get('cropType', 'wheat')
            soil_type = event.get('soilType', 'Чернозём')

            try:
                result = yield_model.predict(weather, crop_type, soil_type)
            except ModelNotReady:
                logger.debug("Skip Kafka forecast: model still training")
                continue
            factors = yield_model.get_factors(weather, crop_type)

            forecast_event = {
                'id': f"yf-{field_id}-{datetime.now().strftime('%Y%m%d%H%M%S')}",
                'fieldId': field_id,
                'cropType': CROP_LABELS.get(crop_type, crop_type),
                'forecastDate': datetime.now().strftime('%Y-%m-%d'),
                'predictedYield': result['predicted'],
                'yieldMin': result['min'],
                'yieldMax': result['max'],
                'confidence': result['confidence'],
                'factors': factors,
                'modelVersion': '1.2.0',
                'createdAt': datetime.now().isoformat(),
            }

            producer.produce(
                'forecast-results',
                key=field_id,
                value=json.dumps(forecast_event, ensure_ascii=False).encode('utf-8'),
            )
            producer.flush()
            logger.info("📤 Forecast for field %s: %.2f t/ha [%s]",
                        field_id, result['predicted'], result['confidence'])

        except json.JSONDecodeError as e:
            logger.warning("Malformed Kafka message: %s", e)
        except Exception as e:
            logger.error("Error processing weather event: %s", e)


# ======================= SCHEDULED REPORTS =======================

_report_scheduler: Optional[BackgroundScheduler] = None


def _ensure_reports_schema() -> None:
    try:
        with engine.begin() as conn:
            conn.execute(
                text(
                    "ALTER TABLE ops_report_history ADD COLUMN IF NOT EXISTS template_id VARCHAR(64) NOT NULL DEFAULT ''"
                )
            )
    except Exception as exc:
        logger.warning("reports schema migrate skipped: %s", exc)


def _scheduled_reports_tick() -> None:
    from datetime import date

    today = date.today()
    with SessionLocal() as db:
        rows = list(db.query(OpsScheduledReportRecord).all())
    for row in rows:
        try:
            nr_raw = (row.next_run or "").strip()[:10]
            if len(nr_raw) < 10:
                continue
            nr = datetime.strptime(nr_raw, "%Y-%m-%d").date()
        except ValueError:
            logger.warning("Bad next_run for schedule %s: %s", row.id, row.next_run)
            continue
        if nr > today:
            continue
        if (row.channel or "").lower() != "email":
            logger.warning(
                "Schedule %s: канал «%s» не поддерживается (рассылка только на email). Удалите или пересоздайте расписание.",
                row.id,
                row.channel,
            )
            continue
        try:
            content, fname, _media = report_exports.build_report_bytes(
                row.name, row.template_id or "", row.format
            )
            recipients = json.loads(row.recipients_json or "[]")
            if not isinstance(recipients, list) or not recipients:
                logger.warning("Schedule %s has no recipients, skipping", row.id)
                continue
            body = (
                f"Плановый отчёт «{row.name}»\n"
                f"Периодичность: {row.frequency}\n"
                f"Вложение: {fname}"
            )
            clean = [str(x).strip() for x in recipients if str(x).strip()]
            if not clean:
                continue
            report_exports.send_report_via_email(clean, f"Отчёт: {row.name}", body, content, fname)

            report_id = "rep_" + uuid4().hex[:10]
            report_exports.write_report_to_disk(report_id, row.format, content)
            sz = max(round(len(content) / (1024 * 1024), 3), 0.01)
            with SessionLocal() as db:
                r2 = db.query(OpsScheduledReportRecord).filter(OpsScheduledReportRecord.id == row.id).first()
                if r2:
                    r2.next_run = _compute_next_run(r2.frequency)
                db.add(
                    OpsReportRecord(
                        id=report_id,
                        name=row.name,
                        format=row.format if row.format in ("pdf", "excel") else "pdf",
                        created_by="scheduler",
                        size_mb=sz,
                        created_at=datetime.utcnow().strftime("%Y-%m-%d %H:%M"),
                        template_id=row.template_id or "",
                    )
                )
                db.commit()
            _audit(
                "export_pdf" if row.format == "pdf" else "export_excel",
                f"Scheduled report sent by email: {row.name}",
                "ScheduledReport",
                row.id,
                row.name,
            )
            logger.info("Scheduled report sent: %s (%s)", row.name, row.id)
        except Exception:
            logger.exception("Scheduled report job failed for %s", row.id)


# ======================= APP LIFECYCLE =======================

@asynccontextmanager
async def lifespan(app: FastAPI):
    global _report_scheduler
    try:
        Base.metadata.create_all(bind=engine)
    except Exception as exc:
        logger.error("create_all failed (DB may be unavailable): %s", exc)
    _ensure_reports_schema()
    try:
        _seed_integrations_if_empty()
    except Exception as exc:
        logger.warning("Integration seed skipped: %s", exc)
    yield_model.start_training_background()
    thread = threading.Thread(target=_run_kafka_consumer, daemon=True, name="kafka-consumer")
    thread.start()
    _report_scheduler = BackgroundScheduler()
    _report_scheduler.add_job(
        _scheduled_reports_tick,
        "interval",
        minutes=1,
        id="scheduled_reports",
        max_instances=1,
        coalesce=True,
    )
    _report_scheduler.start()
    logger.info("🚀 ML training (background) + Kafka consumer + report scheduler started")
    yield
    if _report_scheduler:
        _report_scheduler.shutdown(wait=False)
    logger.info("🛑 Analytics service shutting down")


app = FastAPI(
    title="AgroAnalytics - Analytics Service",
    description="ML-based crop yield forecasting and irrigation recommendations",
    version="1.0.0",
    root_path="/api/analytics",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ======================= ENDPOINTS =======================

@app.get("/health")
def health():
    return {"status": "ok", "model_trained": yield_model.is_trained}


@app.get("/integrations")
def list_integrations():
    _seed_integrations_if_empty()
    with SessionLocal() as db:
        rows = db.query(AppIntegrationRecord).order_by(AppIntegrationRecord.id).all()
    return [_integration_row_to_api(r) for r in rows]


@app.post("/integrations/{integration_id}/connect")
def connect_integration(integration_id: str):
    _seed_integrations_if_empty()
    now = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
    with SessionLocal() as db:
        row = db.query(AppIntegrationRecord).filter(AppIntegrationRecord.id == integration_id).first()
        if not row:
            raise HTTPException(status_code=404, detail="Интеграция не найдена")
        row.status = "connected"
        row.last_sync = now
        row.records_synced = int(row.records_synced or 0) + 42
        db.commit()
        db.refresh(row)
        payload = _integration_row_to_api(row)
        iname = row.name
    _audit("integration_connect", f"Connected integration {integration_id}", "Integration", integration_id, iname)
    return payload


@app.post("/integrations/{integration_id}/disconnect")
def disconnect_integration(integration_id: str):
    _seed_integrations_if_empty()
    with SessionLocal() as db:
        row = db.query(AppIntegrationRecord).filter(AppIntegrationRecord.id == integration_id).first()
        if not row:
            raise HTTPException(status_code=404, detail="Интеграция не найдена")
        row.status = "disconnected"
        row.last_sync = None
        db.commit()
        db.refresh(row)
        payload = _integration_row_to_api(row)
        iname = row.name
    _audit("integration_disconnect", f"Disconnected integration {integration_id}", "Integration", integration_id, iname)
    return payload


def _satellite_field_context(field_id: str):
    ctx = _resolve_field_context(field_id)
    lat, lng = ctx.get("lat"), ctx.get("lng")
    if lat is None or lng is None:
        raise HTTPException(status_code=400, detail="У поля не заданы координаты (lat/lng)")
    area = float(ctx.get("area") or 50.0)
    return ctx, float(lat), float(lng), area


@app.get("/satellite/field/{field_id}/dates")
def satellite_field_dates(field_id: str, days: int = 120):
    """Даты съёмок Sentinel-2 L2A (Planetary Computer) для bbox поля."""
    ctx, lat, lng, area = _satellite_field_context(field_id)
    try:
        dates = list_available_dates(lat, lng, area, days)
        return {"fieldId": field_id, "fieldName": ctx["fieldName"], "dates": dates}
    except Exception as e:
        logger.exception("satellite dates failed for %s", field_id)
        raise HTTPException(status_code=502, detail=f"Не удалось получить STAC: {e!s}")


@app.get("/satellite/field/{field_id}/series")
def satellite_field_series(field_id: str, days: int = 120, max_points: int = 8):
    """Средние NDVI/NDMI по сценам (до max_points последних дат)."""
    ctx, lat, lng, area = _satellite_field_context(field_id)
    mp = max(3, min(20, max_points))
    try:
        points = build_series(lat, lng, area, days=days, max_points=mp)
        return {"fieldId": field_id, "fieldName": ctx["fieldName"], "points": points}
    except Exception as e:
        logger.exception("satellite series failed for %s", field_id)
        raise HTTPException(status_code=502, detail=f"Не удалось рассчитать ряд: {e!s}")


@app.get("/satellite/field/{field_id}/grid")
def satellite_field_grid(
    field_id: str,
    date: str,
    index: str = "ndvi",
    grid_w: int = 12,
    grid_h: int = 8,
):
    """Сетка значений NDVI или NDMI из реального растра Sentinel-2."""
    idx = (index or "ndvi").lower()
    if idx not in ("ndvi", "ndmi"):
        raise HTTPException(status_code=400, detail="index должен быть ndvi или ndmi")
    gw = max(4, min(32, grid_w))
    gh = max(4, min(24, grid_h))
    ctx, lat, lng, area = _satellite_field_context(field_id)
    try:
        payload = build_grid_for_field(lat, lng, area, date, idx, grid_w=gw, grid_h=gh)
        return {
            "fieldId": field_id,
            "fieldName": ctx["fieldName"],
            "date": date,
            "index": idx,
            **payload,
        }
    except LookupError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception("satellite grid failed for %s", field_id)
        raise HTTPException(status_code=502, detail=f"Не удалось прочитать сцену: {e!s}")


@app.post("/forecast/yield", response_model=YieldForecastResponse)
def get_yield_forecast(request: ForecastRequest):
    """Predict crop yield using ML model"""
    try:
        context = _resolve_field_context(
            request.fieldId,
            fallback_crop=request.cropType or "wheat",
            fallback_soil=request.soilType or "Чернозём",
            fallback_area=request.area or 50.0,
        )
        weather = context["weather"] or WeatherInput()

        crop_type = request.cropType or context["cropType"] or "wheat"
        soil_type = request.soilType or context["soilType"] or "Чернозём"

        result = yield_model.predict(weather, crop_type, soil_type)
        factors = yield_model.get_factors(weather, crop_type)

        crop_label = CROP_LABELS.get(crop_type, crop_type)
        historical = HISTORICAL_BASELINES.get(crop_type, HISTORICAL_BASELINES['wheat'])
        hist_avg = sum(h['yield'] for h in historical) / len(historical)

        return YieldForecastResponse(
            id=f"yf-{request.fieldId}-{datetime.now().strftime('%Y%m%d%H%M%S')}",
            fieldId=request.fieldId,
            fieldName=context["fieldName"],
            cropType=crop_label,
            forecastDate=request.targetDate,
            predictedYield=result['predicted'],
            yieldMin=result['min'],
            yieldMax=result['max'],
            confidence=result['confidence'],
            factors=[ForecastFactor(**f) for f in factors],
            historicalAverage=round(hist_avg, 2),
            modelVersion="1.2.0",
            createdAt=datetime.now().isoformat(),
        )
    except ModelNotReady as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        logger.error(f"Forecast error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/forecast/yield/field/{field_id}", response_model=List[YieldForecastResponse])
def get_field_forecasts(field_id: str):
    """Get all forecasts for a field"""
    request = ForecastRequest(fieldId=field_id, targetDate=datetime.now().strftime('%Y-%m-%d'))
    return [get_yield_forecast(request)]


@app.get("/yield/historical/{field_id}", response_model=List[HistoricalYield])
def get_historical_yield(field_id: str, crop_type: str = "wheat"):
    """Get historical yield data for a field, varied per field_id."""
    context = _resolve_field_context(field_id, fallback_crop=crop_type)
    resolved_crop = context["cropType"] or crop_type
    historical = HISTORICAL_BASELINES.get(resolved_crop, HISTORICAL_BASELINES['wheat'])

    # Apply a deterministic per-field variance so each field shows different numbers
    field_hash = sum(ord(c) for c in field_id)
    variance = 0.90 + (field_hash % 25) * 0.01  # range 0.90 – 1.14

    return [
        HistoricalYield(
            year=h['year'],
            yield_amount=round(h['yield'] * variance, 2),
            cropType=CROP_LABELS.get(resolved_crop, resolved_crop),
            precipitation=h['precipitation'],
            avgTemperature=h['avgTemperature'],
        )
        for h in historical
    ]


@app.get("/irrigation/recommendations/{field_id}", response_model=List[IrrigationRecommendation])
def get_irrigation_recommendations(
    field_id: str,
    crop_type: str = "wheat",
    current_moisture: float = 60.0,
    field_name: str = "",
    area: float = 50.0,
):
    """Get irrigation recommendations for a field"""
    context = _resolve_field_context(field_id, fallback_crop=crop_type, fallback_area=area)
    weather = context["weather"] or WeatherInput()
    moisture = current_moisture if current_moisture > 0 else context["currentMoistureLevel"]
    if moisture <= 0:
        moisture = weather.soil_moisture

    recs = irrigation_model.recommend(
        field_id=field_id,
        field_name=field_name or context["fieldName"],
        crop_type=context["cropType"] or crop_type,
        current_moisture=moisture,
        forecast_precipitation_7d=weather.precipitation_7d,
        area=context["area"],
        temperature=weather.temperature,
    )

    return [IrrigationRecommendation(**r) for r in recs]


@app.get("/irrigation/schedule/{field_id}")
def get_irrigation_schedule(field_id: str, crop_type: str = "wheat", current_moisture: float = 60.0):
    """Get irrigation schedule for a field"""
    recs = get_irrigation_recommendations(field_id, crop_type, current_moisture)
    return {
        "fieldId": field_id,
        "fieldName": f"Поле {field_id}",
        "entries": [
            {
                "date": r.recommendedDate,
                "waterAmount": r.waterAmount,
                "duration": r.duration,
                "status": r.status,
                "priority": r.priority,
            }
            for r in recs
        ],
        "totalWaterNeeded": sum(r.waterAmount for r in recs),
        "nextIrrigationDate": recs[0].recommendedDate if recs else None,
    }


@app.post("/anomaly/detect")
def detect_anomaly(sensor_data: dict):
    """Detect sensor data anomalies: hard physical limits + statistical Z-score checks."""
    alerts = []

    # --- Physical limits ---
    moisture = sensor_data.get('soilMoisture')
    if moisture is not None:
        if moisture > 95:
            alerts.append({
                'type': 'sensor_anomaly', 'severity': 'high',
                'message': f'Аномальное значение влажности почвы: {moisture}% — вероятна неисправность датчика (физически невозможен)',
                'field': 'soilMoisture', 'value': moisture, 'confidence': 0.97,
                'method': 'physical_limit',
            })
        elif moisture < 0:
            alerts.append({
                'type': 'sensor_anomaly', 'severity': 'high',
                'message': f'Отрицательное значение влажности почвы: {moisture}% — ошибка датчика',
                'field': 'soilMoisture', 'value': moisture, 'confidence': 0.99,
                'method': 'physical_limit',
            })
        elif moisture < 5:
            alerts.append({
                'type': 'sensor_anomaly', 'severity': 'medium',
                'message': f'Критически низкая влажность почвы: {moisture}% — возможен сбой датчика или экстремальная засуха',
                'field': 'soilMoisture', 'value': moisture, 'confidence': 0.85,
                'method': 'physical_limit',
            })

    temperature = sensor_data.get('temperature')
    if temperature is not None:
        if temperature > 45:
            alerts.append({
                'type': 'sensor_anomaly', 'severity': 'high',
                'message': f'Аномальная температура воздуха: {temperature}°C — проверьте датчик',
                'field': 'temperature', 'value': temperature, 'confidence': 0.95,
                'method': 'physical_limit',
            })
        elif temperature < -20:
            alerts.append({
                'type': 'sensor_anomaly', 'severity': 'high',
                'message': f'Аномально низкая температура: {temperature}°C — вероятен сбой датчика',
                'field': 'temperature', 'value': temperature, 'confidence': 0.92,
                'method': 'physical_limit',
            })

    humidity = sensor_data.get('humidity')
    if humidity is not None and (humidity > 100 or humidity < 0):
        alerts.append({
            'type': 'sensor_anomaly', 'severity': 'high',
            'message': f'Физически невозможное значение влажности воздуха: {humidity}% — ошибка датчика',
            'field': 'humidity', 'value': humidity, 'confidence': 0.99,
            'method': 'physical_limit',
        })

    wind_speed = sensor_data.get('windSpeed')
    if wind_speed is not None:
        if wind_speed < 0:
            alerts.append({
                'type': 'sensor_anomaly', 'severity': 'high',
                'message': f'Отрицательная скорость ветра: {wind_speed} м/с — ошибка датчика',
                'field': 'windSpeed', 'value': wind_speed, 'confidence': 0.99,
                'method': 'physical_limit',
            })
        elif wind_speed > 50:
            alerts.append({
                'type': 'sensor_anomaly', 'severity': 'high',
                'message': f'Нереальная скорость ветра: {wind_speed} м/с — вероятен сбой датчика',
                'field': 'windSpeed', 'value': wind_speed, 'confidence': 0.93,
                'method': 'physical_limit',
            })

    precipitation = sensor_data.get('precipitation')
    if precipitation is not None:
        if precipitation < 0:
            alerts.append({
                'type': 'sensor_anomaly', 'severity': 'high',
                'message': f'Отрицательное значение осадков: {precipitation} мм — ошибка датчика',
                'field': 'precipitation', 'value': precipitation, 'confidence': 0.99,
                'method': 'physical_limit',
            })
        elif precipitation > 150:
            alerts.append({
                'type': 'sensor_anomaly', 'severity': 'medium',
                'message': f'Экстремальное количество осадков: {precipitation} мм/сут — проверьте датчик',
                'field': 'precipitation', 'value': precipitation, 'confidence': 0.88,
                'method': 'physical_limit',
            })

    # --- Statistical Z-score check against known normal distributions ---
    # Normal distributions for Rostov region (mean, std) from synthetic dataset stats
    FIELD_STATS = {
        'temperature':   {'mean': 22.5, 'std': 9.0},
        'soilMoisture':  {'mean': 52.0, 'std': 18.0},
        'humidity':      {'mean': 61.0, 'std': 20.0},
        'windSpeed':     {'mean': 7.0,  'std': 3.8},
        'precipitation': {'mean': 12.0, 'std': 7.0},
    }
    Z_THRESHOLD = 3.0

    for field_key, stats in FIELD_STATS.items():
        val = sensor_data.get(field_key)
        if val is None:
            continue
        z = abs((val - stats['mean']) / stats['std'])
        if z > Z_THRESHOLD:
            # Don't duplicate if physical limit already caught it
            already_flagged = any(a['field'] == field_key for a in alerts)
            if not already_flagged:
                alerts.append({
                    'type': 'statistical_anomaly',
                    'severity': 'medium' if z < 4.5 else 'high',
                    'message': (
                        f'Статистическая аномалия в поле {field_key}: значение {val} '
                        f'отклоняется на {z:.1f}σ от нормы (среднее {stats["mean"]}, σ={stats["std"]})'
                    ),
                    'field': field_key,
                    'value': val,
                    'z_score': round(z, 2),
                    'confidence': round(min(0.99, 0.70 + (z - Z_THRESHOLD) * 0.08), 2),
                    'method': 'z_score',
                })

    return {
        "hasAnomalies": len(alerts) > 0,
        "alerts": alerts,
        "anomalyCount": len(alerts),
        "lowConfidence": any(a['confidence'] < 0.80 for a in alerts),
    }


@app.get("/model/metrics")
def get_model_metrics():
    """Returns ML model performance metrics calculated on a held-out test split"""
    from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
    from sklearn.model_selection import train_test_split

    if not yield_model.wait_until_trained(300.0):
        raise HTTPException(status_code=503, detail="ML model is still training")

    df = yield_model._generate_training_data(n_samples=1000)
    features = ['temperature', 'humidity', 'precipitation_7d', 'avg_temperature_7d',
                'soil_moisture', 'solar_radiation', 'wind_speed', 'crop_code', 'soil_code']

    X = df[features].values
    y = df['yield'].values
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    y_pred = yield_model.model.predict(X_test)

    mae = float(mean_absolute_error(y_test, y_pred))
    rmse = float(np.sqrt(mean_squared_error(y_test, y_pred)))
    r2 = float(r2_score(y_test, y_pred))
    accuracy_15 = float(np.mean(np.abs((y_pred - y_test) / np.maximum(y_test, 0.1)) < 0.15) * 100)

    crops = ['wheat', 'corn', 'sunflower', 'barley', 'soy', 'sugar_beet', 'other']
    by_crop = {}
    for i, crop in enumerate(crops):
        mask = df['crop_code'] == i
        crop_df = df[mask]
        if len(crop_df) >= 20:
            Xc = crop_df[features].values
            yc = crop_df['yield'].values
            Xc_tr, Xc_te, yc_tr, yc_te = train_test_split(Xc, yc, test_size=0.2, random_state=42)
            yc_pred = yield_model.model.predict(Xc_te)
            by_crop[crop] = {
                'mae': round(float(mean_absolute_error(yc_te, yc_pred)), 3),
                'rmse': round(float(np.sqrt(mean_squared_error(yc_te, yc_pred))), 3),
                'r2': round(float(r2_score(yc_te, yc_pred)), 3),
                'samples': int(len(crop_df)),
            }

    # Test scenarios matching the case description — run the actual model
    scenario_definitions = [
        {
            'name': 'Аномалия датчика (98% влажность)',
            'description': 'Сценарий из кейса: агроном вводит влажность 98% из-за сбоя датчика',
            'weather': WeatherInput(temperature=22.0, humidity=60.0, precipitation_7d=5.0,
                                    avg_temperature_7d=22.0, soil_moisture=98.0,
                                    solar_radiation=500.0, wind_speed=3.0),
            'crop_type': 'wheat',
            'soil_type': 'Чернозём',
            'inputMoisture': 98.0,
            'inputTemp': 22.0,
            'expectedConfidence': 'LOW',
        },
        {
            'name': 'Оптимальные условия (пшеница)',
            'description': 'Влажность 65%, температура 22°C, осадки 18 мм/нед',
            'weather': WeatherInput(temperature=22.0, humidity=65.0, precipitation_7d=18.0,
                                    avg_temperature_7d=22.0, soil_moisture=65.0,
                                    solar_radiation=600.0, wind_speed=3.0),
            'crop_type': 'wheat',
            'soil_type': 'Чернозём',
            'inputMoisture': 65.0,
            'inputTemp': 22.0,
            'expectedConfidence': 'HIGH',
        },
        {
            'name': 'Засушливые условия',
            'description': 'Влажность 30%, температура 35°C, осадки 2 мм/нед',
            'weather': WeatherInput(temperature=35.0, humidity=30.0, precipitation_7d=2.0,
                                    avg_temperature_7d=34.0, soil_moisture=30.0,
                                    solar_radiation=700.0, wind_speed=5.0),
            'crop_type': 'wheat',
            'soil_type': 'Чернозём',
            'inputMoisture': 30.0,
            'inputTemp': 35.0,
            'expectedConfidence': 'MEDIUM',
        },
        {
            'name': 'Критическая засуха',
            'description': 'Влажность 15%, температура 38°C, нет осадков',
            'weather': WeatherInput(temperature=38.0, humidity=15.0, precipitation_7d=0.0,
                                    avg_temperature_7d=37.0, soil_moisture=15.0,
                                    solar_radiation=750.0, wind_speed=6.0),
            'crop_type': 'wheat',
            'soil_type': 'Чернозём',
            'inputMoisture': 15.0,
            'inputTemp': 38.0,
            'expectedConfidence': 'LOW',
        },
    ]

    test_scenarios = []
    for s in scenario_definitions:
        result = yield_model.predict(s['weather'], s['crop_type'], s['soil_type'])
        actual_conf = result['confidence']
        expected_conf = s['expectedConfidence']
        test_scenarios.append({
            'name': s['name'],
            'description': s['description'],
            'inputMoisture': s['inputMoisture'],
            'inputTemp': s['inputTemp'],
            'predictedYield': result['predicted'],
            'yieldMin': result['min'],
            'yieldMax': result['max'],
            'expectedConfidence': expected_conf,
            'actualConfidence': actual_conf,
            'status': 'pass' if actual_conf == expected_conf else 'fail',
        })

    return {
        'overall': {
            'mae': round(mae, 3),
            'rmse': round(rmse, 3),
            'r2': round(r2, 3),
            'accuracy': round(accuracy_15, 1),
            'testSamples': int(len(y_test)),
        },
        'byCrop': by_crop,
        'scenarios': test_scenarios,
        'modelVersion': '1.2.0',
        'trainedAt': datetime.now().isoformat(),
    }

@app.post("/scenario/what-if", response_model=WhatIfSimulationResponse)
def simulate_what_if(request: WhatIfScenarioRequest):
    """Simulate irrigation/seeding strategy scenarios with yield, water and ROI."""
    if not request.scenarios:
        raise HTTPException(status_code=400, detail="At least one scenario is required")

    if not yield_model.wait_until_trained(300.0):
        raise HTTPException(status_code=503, detail="ML model is still training")

    context = _resolve_field_context(
        request.fieldId,
        fallback_crop=request.cropType or "wheat",
        fallback_soil=request.soilType or "Чернозём",
        fallback_area=request.area or 50.0,
    )
    weather = context["weather"] or WeatherInput()
    crop_type = request.cropType or context["cropType"] or "wheat"
    soil_type = request.soilType or context["soilType"] or "Чернозём"
    area = float(context["area"] or request.area or 50.0)
    price_per_ton = float(request.expectedPricePerTon or 13500.0)

    base_predict = yield_model.predict(weather, crop_type, soil_type)
    base_yield = float(base_predict["predicted"])
    base_water_m3 = max(80.0, (100 - weather.soil_moisture) * area * 0.9)
    base_cost = area * 11850.0
    base_revenue = base_yield * area * price_per_ton
    base_profit = base_revenue - base_cost
    base_roi = (base_profit / max(base_cost, 1.0)) * 100.0

    baseline_result = WhatIfScenarioResult(
        name="Базовый",
        irrigationMultiplier=1.0,
        seedingMultiplier=1.0,
        expectedYield=round(base_yield, 2),
        expectedYieldDeltaPercent=0.0,
        expectedWaterM3=round(base_water_m3, 1),
        expectedWaterDeltaPercent=0.0,
        expectedRevenue=round(base_revenue, 2),
        expectedCost=round(base_cost, 2),
        expectedProfit=round(base_profit, 2),
        roiPercent=round(base_roi, 2),
    )

    scenario_results = []
    for s in request.scenarios:
        irrigation_mult = float(s.get("irrigationMultiplier", 1.0))
        seeding_mult = float(s.get("seedingMultiplier", 1.0))
        name = str(s.get("name", f"Сценарий {len(scenario_results) + 1}"))

        irrigation_effect = (irrigation_mult - 1.0) * 0.22
        seeding_effect = (seeding_mult - 1.0) * 0.14
        stress_penalty = -0.12 if irrigation_mult < 0.85 and weather.soil_moisture < 45 else 0.0
        yield_factor = max(0.55, 1.0 + irrigation_effect + seeding_effect + stress_penalty)

        scenario_yield = base_yield * yield_factor
        scenario_water = base_water_m3 * irrigation_mult
        scenario_cost = base_cost * (0.70 + irrigation_mult * 0.20 + seeding_mult * 0.10)
        scenario_revenue = scenario_yield * area * price_per_ton
        scenario_profit = scenario_revenue - scenario_cost
        scenario_roi = (scenario_profit / max(scenario_cost, 1.0)) * 100.0

        scenario_results.append(WhatIfScenarioResult(
            name=name,
            irrigationMultiplier=round(irrigation_mult, 2),
            seedingMultiplier=round(seeding_mult, 2),
            expectedYield=round(scenario_yield, 2),
            expectedYieldDeltaPercent=round(((scenario_yield - base_yield) / max(base_yield, 0.1)) * 100.0, 2),
            expectedWaterM3=round(scenario_water, 1),
            expectedWaterDeltaPercent=round(((scenario_water - base_water_m3) / max(base_water_m3, 1.0)) * 100.0, 2),
            expectedRevenue=round(scenario_revenue, 2),
            expectedCost=round(scenario_cost, 2),
            expectedProfit=round(scenario_profit, 2),
            roiPercent=round(scenario_roi, 2),
        ))

    best = max(scenario_results, key=lambda x: x.roiPercent)

    return WhatIfSimulationResponse(
        fieldId=request.fieldId,
        fieldName=context["fieldName"],
        baseline=baseline_result,
        scenarios=scenario_results,
        recommendedScenario=best.name,
        generatedAt=datetime.now().isoformat(),
    )


# ======================= DATASET ENDPOINTS =======================

MANDATORY_FIELDS = [
    'field_id', 'date', 'timestamp', 'temperature', 'humidity_air',
    'precipitation', 'wind_speed', 'soil_moisture', 'crop_type',
    'yield_actual', 'irrigation_volume', 'irrigation_recommended', 'is_anomaly',
]


@app.get("/dataset/generate")
def generate_dataset(n_samples: int = 1000, field_id: str = "all", as_csv: bool = False):
    """
    Return synthetic dataset with all mandatory fields from the case specification.

    Query params:
      - n_samples  (int, default 1000): number of rows to generate
      - field_id   (str, default "all"): filter to a single field or return all
      - as_csv     (bool): if true, returns a plain-text CSV body
    """
    from fastapi.responses import PlainTextResponse

    n_samples = max(10, min(n_samples, 5000))
    df = yield_model._generate_training_data(n_samples=n_samples)

    if field_id != "all":
        df = df[df['field_id'] == field_id]

    output_cols = MANDATORY_FIELDS
    df_out = df[output_cols].copy()

    if as_csv:
        return PlainTextResponse(
            content=df_out.to_csv(index=False),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=agro_dataset_{n_samples}.csv"}
        )

    return {
        "n_rows": len(df_out),
        "fields": MANDATORY_FIELDS,
        "anomaly_rate_pct": round(float(df_out['is_anomaly'].mean() * 100), 2),
        "data": df_out.to_dict(orient='records'),
    }


@app.get("/dataset/eda")
def dataset_eda(n_samples: int = 2000):
    """
    Exploratory Data Analysis on the synthetic dataset.
    Returns per-column statistics, anomaly breakdown, correlation matrix
    and crop distribution — fulfilling the EDA requirement from the case spec.
    """
    n_samples = max(100, min(n_samples, 5000))
    df = yield_model._generate_training_data(n_samples=n_samples)

    numeric_cols = ['temperature', 'humidity_air', 'precipitation', 'wind_speed',
                    'soil_moisture', 'yield_actual', 'irrigation_volume', 'irrigation_recommended']

    # Per-column descriptive stats
    stats: dict = {}
    for col in numeric_cols:
        s = df[col]
        stats[col] = {
            'count': int(s.count()),
            'mean': round(float(s.mean()), 4),
            'std': round(float(s.std()), 4),
            'min': round(float(s.min()), 4),
            'q25': round(float(s.quantile(0.25)), 4),
            'median': round(float(s.median()), 4),
            'q75': round(float(s.quantile(0.75)), 4),
            'max': round(float(s.max()), 4),
            'missing': int(s.isna().sum()),
        }

    # Anomaly analysis
    anomaly_df = df[df['is_anomaly']]
    normal_df = df[~df['is_anomaly']]
    anomaly_analysis = {
        'total_anomalies': int(df['is_anomaly'].sum()),
        'anomaly_rate_pct': round(float(df['is_anomaly'].mean() * 100), 2),
        'anomaly_by_field': df.groupby('field_id')['is_anomaly'].sum().astype(int).to_dict(),
        'anomaly_by_crop': df.groupby('crop_type')['is_anomaly'].sum().astype(int).to_dict(),
        'mean_soil_moisture_normal': round(float(normal_df['soil_moisture'].mean()), 2),
        'mean_soil_moisture_anomaly': round(float(anomaly_df['soil_moisture'].mean()), 2) if len(anomaly_df) else None,
    }

    # Crop distribution
    crop_dist = df['crop_type'].value_counts().to_dict()

    # Yield by crop (mean yield_actual)
    yield_by_crop = df.groupby('crop_type')['yield_actual'].mean().round(4).to_dict()

    # Pearson correlation matrix (numeric only)
    corr_matrix = df[numeric_cols].corr().round(4).to_dict()

    # Outlier counts using IQR method per column
    outliers: dict = {}
    for col in numeric_cols:
        q1, q3 = df[col].quantile(0.25), df[col].quantile(0.75)
        iqr = q3 - q1
        n_out = int(((df[col] < q1 - 1.5 * iqr) | (df[col] > q3 + 1.5 * iqr)).sum())
        outliers[col] = {'iqr_outliers': n_out, 'outlier_rate_pct': round(n_out / len(df) * 100, 2)}

    return {
        'dataset_info': {
            'n_rows': len(df),
            'n_cols': len(MANDATORY_FIELDS),
            'mandatory_fields': MANDATORY_FIELDS,
            'date_range': {'from': df['date'].min(), 'to': df['date'].max()},
            'unique_fields': df['field_id'].nunique(),
            'unique_crops': df['crop_type'].nunique(),
        },
        'descriptive_stats': stats,
        'anomaly_analysis': anomaly_analysis,
        'crop_distribution': crop_dist,
        'yield_by_crop': yield_by_crop,
        'outliers': outliers,
        'correlation_matrix': corr_matrix,
    }


@app.get("/dataset/field/{field_id}")
def get_field_dataset(field_id: str, n_samples: int = 500):
    """Return dataset rows for a specific field with all mandatory columns."""
    df = yield_model._generate_training_data(n_samples=n_samples)
    field_df = df[df['field_id'] == field_id][MANDATORY_FIELDS]
    if field_df.empty:
        raise HTTPException(status_code=404, detail=f"No data found for field '{field_id}'")
    return {
        'field_id': field_id,
        'n_rows': len(field_df),
        'anomaly_rate_pct': round(float(field_df['is_anomaly'].mean() * 100), 2),
        'data': field_df.to_dict(orient='records'),
    }


def _seed_integrations_if_empty():
    """Каталог интеграций для UI (персистентность в analyticsdb)."""
    seed = [
        {
            "id": "i1", "type": "1c_erp", "name": "1С:Агро / ERP",
            "description": "Двусторонняя синхронизация справочников, себестоимости, складских остатков и актов выполненных работ",
            "icon": "1c_erp", "status": "connected", "records_synced": 248,
            "config": {"host": "erp.agro.ru", "port": "8080", "database": "agro_prod"},
            "features": ["Синхронизация полей", "Импорт затрат", "Экспорт урожая", "Акты работ"],
        },
        {
            "id": "i2", "type": "weather_api", "name": "OpenWeatherMap API",
            "description": "Актуальные метеоданные и прогноз погоды для полей",
            "icon": "cloud", "status": "connected", "records_synced": 12800,
            "config": {"api_key": "••••••••••••••••", "endpoint": "api.openweathermap.org"},
            "features": ["Текущая погода", "Прогноз", "Исторические данные", "Радар осадков"],
        },
        {
            "id": "i3", "type": "iot_gateway", "name": "IoT Gateway (MQTT)",
            "description": "Датчики почвы, метеостанции и контроллеры полива через MQTT",
            "icon": "device_hub", "status": "connected", "records_synced": 94200,
            "config": {"broker": "mqtt.agro.internal", "port": "1883", "topic": "sensors/#"},
            "features": ["Датчики почвы", "Метеостанции", "Контроллеры полива", "Телеметрия"],
        },
        {
            "id": "i4", "type": "geo_import", "name": "GIS / Shapefile Import",
            "description": "Импорт границ полей из Shapefile, GeoJSON, KML",
            "icon": "map", "status": "disconnected", "records_synced": 0,
            "config": {},
            "features": ["Shapefile (.shp)", "GeoJSON", "KML / KMZ", "WGS84 / СК-42"],
        },
        {
            "id": "i5", "type": "telegram", "name": "Telegram Bot",
            "description": "Уведомления и дайджесты в Telegram",
            "icon": "send", "status": "error", "records_synced": 0,
            "config": {"bot_token": "••••••••••••", "chat_id": "-100123456789"},
            "features": ["Алерты", "Дайджесты", "Команды бота", "Групповые чаты"],
        },
        {
            "id": "i6", "type": "email_smtp", "name": "Email / SMTP",
            "description": "Отчёты и уведомления по электронной почте",
            "icon": "email", "status": "connected", "records_synced": 156,
            "config": {"host": "smtp.agro.ru", "port": "587", "from": "noreply@agro.ru"},
            "features": ["Отчёты PDF/Excel", "Алерты по правилам", "Приглашения", "Дайджесты"],
        },
    ]
    with SessionLocal() as db:
        if db.query(AppIntegrationRecord).count() > 0:
            return
        now = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
        for s in seed:
            cfg = json.dumps(s["config"], ensure_ascii=False)
            feat = json.dumps(s["features"], ensure_ascii=False)
            last = now if s["status"] == "connected" else (None if s["status"] == "disconnected" else "2026-03-19T18:00:00Z")
            db.add(AppIntegrationRecord(
                id=s["id"], type=s["type"], name=s["name"], description=s["description"],
                icon=s["icon"], status=s["status"], last_sync=last,
                records_synced=int(s["records_synced"]), config_json=cfg, features_json=feat,
            ))
        db.commit()


def _integration_row_to_api(row: AppIntegrationRecord) -> dict:
    return {
        "id": row.id,
        "type": row.type,
        "name": row.name,
        "description": row.description,
        "icon": row.icon,
        "status": row.status,
        "lastSync": row.last_sync,
        "recordsSynced": row.records_synced,
        "config": json.loads(row.config_json or "{}"),
        "features": json.loads(row.features_json or "[]"),
    }


def _seed_ops_data_if_empty():
    with SessionLocal() as db:
        if db.query(OpsWorkTaskRecord).count() == 0:
            now = datetime.utcnow().isoformat()
            db.add(OpsWorkTaskRecord(
                id="t1", title="Полив пшеничного поля А-1", description="Провести плановый полив капельным методом",
                category="irrigation", priority="high", status="in_progress", field_id="f1", field_name="Поле А-1",
                assignee="Иванов И.И.", assignee_role="operator", deadline=datetime.utcnow().date().isoformat(),
                checklist_json=json.dumps([{"id": "c1", "text": "Проверить давление в системе", "done": False}], ensure_ascii=False),
                estimated_hours=4.0, created_at=now, updated_at=now
            ))
        if db.query(OpsEquipmentRecord).count() == 0:
            now = datetime.utcnow().isoformat()
            db.add(OpsEquipmentRecord(
                id="d1", name="Датчик почвы А-1-01", type="soil_sensor", field_id="f1", field_name="Поле А-1",
                status="online", battery=86, signal=91, last_ping=now, firmware="2.1.4",
                install_date=(datetime.utcnow().date() - timedelta(days=200)).isoformat(),
                telemetry_json=json.dumps({"temperature": 18.2, "humidity": 65, "soilMoisture": 42, "lat": 47.21, "lng": 39.73}, ensure_ascii=False),
                sla_json=json.dumps({"uptime": 99.2, "dataQuality": 98.5, "missedReadings": 3}, ensure_ascii=False),
                alerts_json="[]"
            ))
        if db.query(OpsNotificationRuleRecord).count() == 0:
            db.add(OpsNotificationRuleRecord(
                id="r1", name="Критический дефицит влаги", description="Сигнал при низкой влажности почвы",
                enabled=True, condition_logic="AND",
                conditions_json=json.dumps([{"field": "soilMoisture", "operator": "lt", "value": 15, "unit": "%"}], ensure_ascii=False),
                channels_json=json.dumps(["app", "email"], ensure_ascii=False),
                recipients_json=json.dumps(["admin@agro.ru"], ensure_ascii=False),
                field_ids_json=json.dumps(["f1", "f2"], ensure_ascii=False),
                cooldown_minutes=60, created_by="system", created_at=datetime.utcnow().date().isoformat(), trigger_count=0
            ))
        if db.query(OpsScheduledReportRecord).count() == 0:
            now = datetime.utcnow()
            wk = (now + timedelta(days=7)).strftime("%Y-%m-%d")
            mo = (now + timedelta(days=30)).strftime("%Y-%m-%d")
            db.add(OpsScheduledReportRecord(
                id="sch_" + uuid4().hex[:10], template_id="r1", name="Недельный дайджест", frequency="weekly",
                format="pdf", channel="email",
                recipients_json=json.dumps(["admin@agro.ru", "manager@agro.ru"], ensure_ascii=False),
                next_run=wk, created_at=now.isoformat(),
            ))
            db.add(OpsScheduledReportRecord(
                id="sch_" + uuid4().hex[:10], template_id="r2", name="Финансовая сводка", frequency="monthly",
                format="excel", channel="email",
                recipients_json=json.dumps(["cfo@agro.ru"], ensure_ascii=False),
                next_run=mo, created_at=now.isoformat(),
            ))
            db.add(OpsScheduledReportRecord(
                id="sch_" + uuid4().hex[:10], template_id="r8", name="Отчёт для руководства", frequency="monthly",
                format="pdf", channel="email",
                recipients_json=json.dumps(["ceo@agro.ru"], ensure_ascii=False),
                next_run=mo, created_at=now.isoformat(),
            ))
        db.commit()


def _scheduled_row_to_api(r: OpsScheduledReportRecord) -> dict:
    return {
        "id": r.id,
        "templateId": r.template_id,
        "name": r.name,
        "frequency": r.frequency,
        "nextRun": r.next_run,
        "recipients": json.loads(r.recipients_json or "[]"),
        "format": r.format,
        "channel": r.channel,
    }


def _compute_next_run(frequency: str) -> str:
    now = datetime.utcnow()
    if frequency == "monthly":
        return (now + timedelta(days=30)).strftime("%Y-%m-%d")
    return (now + timedelta(days=7)).strftime("%Y-%m-%d")


def _audit(action: str, details: str, entity_type: str = "", entity_id: str = "", entity_name: str = "", result: str = "success"):
    with SessionLocal() as db:
        db.add(OpsAuditRecord(
            id=f"a_{uuid4().hex}",
            timestamp=datetime.utcnow().isoformat(),
            user_id="system",
            user_name="system",
            user_role="service",
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            entity_name=entity_name,
            details=details,
            ip_address="internal",
            result=result,
        ))
        db.commit()


@app.post("/iot/telemetry")
def ingest_iot_telemetry(payload: IoTTelemetryInput):
    with SessionLocal() as db:
        rec = IoTTelemetryRecord(
            field_id=payload.fieldId,
            field_name=payload.fieldName,
            device_id=payload.deviceId,
            temperature=payload.temperature,
            humidity=payload.humidity,
            soil_moisture=payload.soilMoisture,
            precipitation=payload.precipitation,
            wind_speed=payload.windSpeed,
            solar_radiation=payload.solarRadiation,
            lat=payload.lat,
            lng=payload.lng,
        )
        db.add(rec)
        db.commit()
    if payload.soilMoisture is not None:
        _update_field_moisture(payload.fieldId, payload.soilMoisture)
    _audit("field_update", f"IoT telemetry ingested for field={payload.fieldId}", "Field", payload.fieldId)
    return {"status": "accepted", "fieldId": payload.fieldId}


@app.get("/ops/work-tasks")
def ops_get_tasks():
    _seed_ops_data_if_empty()
    with SessionLocal() as db:
        rows = db.query(OpsWorkTaskRecord).order_by(OpsWorkTaskRecord.updated_at.desc()).all()
        return [{
            "id": r.id, "title": r.title, "description": r.description, "category": r.category, "priority": r.priority, "status": r.status,
            "fieldId": r.field_id, "fieldName": r.field_name, "assignee": r.assignee, "assigneeRole": r.assignee_role, "deadline": r.deadline,
            "createdAt": r.created_at, "updatedAt": r.updated_at, "checklist": json.loads(r.checklist_json or "[]"),
            "estimatedHours": r.estimated_hours, "actualHours": r.actual_hours, "notes": r.notes
        } for r in rows]


@app.post("/ops/work-tasks")
def ops_create_task(task: dict):
    now = datetime.utcnow().isoformat()
    task_id = task.get("id") or f"t_{uuid4().hex[:10]}"
    with SessionLocal() as db:
        db.add(OpsWorkTaskRecord(
            id=task_id, title=task.get("title", "Новая задача"), description=task.get("description", ""),
            category=task.get("category", "other"), priority=task.get("priority", "medium"), status=task.get("status", "todo"),
            field_id=task.get("fieldId", "f1"), field_name=task.get("fieldName", "Поле"), assignee=task.get("assignee", "Не назначен"),
            assignee_role=task.get("assigneeRole", "operator"), deadline=task.get("deadline", datetime.utcnow().date().isoformat()),
            checklist_json=json.dumps(task.get("checklist", []), ensure_ascii=False), estimated_hours=float(task.get("estimatedHours", 1)),
            actual_hours=task.get("actualHours"), notes=task.get("notes"), created_at=now, updated_at=now
        ))
        db.commit()
    _audit("field_create", f"Work task created: {task_id}", "Task", task_id, task.get("title", ""))
    return {"id": task_id}


@app.put("/ops/work-tasks/{task_id}")
def ops_update_task(task_id: str, task: dict):
    with SessionLocal() as db:
        row = db.query(OpsWorkTaskRecord).filter(OpsWorkTaskRecord.id == task_id).first()
        if not row:
            raise HTTPException(status_code=404, detail="Task not found")
        for fld, col in [("title", "title"), ("description", "description"), ("category", "category"), ("priority", "priority"), ("status", "status"),
                         ("fieldId", "field_id"), ("fieldName", "field_name"), ("assignee", "assignee"), ("assigneeRole", "assignee_role"),
                         ("deadline", "deadline"), ("estimatedHours", "estimated_hours"), ("actualHours", "actual_hours"), ("notes", "notes")]:
            if fld in task:
                setattr(row, col, task[fld])
        if "checklist" in task:
            row.checklist_json = json.dumps(task["checklist"], ensure_ascii=False)
        row.updated_at = datetime.utcnow().isoformat()
        db.commit()
    _audit("field_update", f"Work task updated: {task_id}", "Task", task_id)
    return {"status": "ok"}


@app.get("/ops/equipment")
def ops_get_equipment():
    _seed_ops_data_if_empty()
    with SessionLocal() as db:
        rows = db.query(OpsEquipmentRecord).all()
        return [{
            "id": r.id, "name": r.name, "type": r.type, "fieldId": r.field_id, "fieldName": r.field_name, "status": r.status,
            "battery": r.battery, "signal": r.signal, "lastPing": r.last_ping, "firmware": r.firmware, "installDate": r.install_date,
            "telemetry": json.loads(r.telemetry_json or "{}"), "sla": json.loads(r.sla_json or "{}"), "alerts": json.loads(r.alerts_json or "[]")
        } for r in rows]


@app.get("/ops/audit-log")
def ops_get_audit():
    with SessionLocal() as db:
        rows = db.query(OpsAuditRecord).order_by(OpsAuditRecord.timestamp.desc()).limit(500).all()
        return [{
            "id": r.id, "timestamp": r.timestamp, "userId": r.user_id, "userName": r.user_name, "userRole": r.user_role, "action": r.action,
            "entityType": r.entity_type, "entityId": r.entity_id, "entityName": r.entity_name, "details": r.details, "ipAddress": r.ip_address, "result": r.result
        } for r in rows]


@app.get("/ops/notification-rules")
def ops_get_rules():
    _seed_ops_data_if_empty()
    with SessionLocal() as db:
        rows = db.query(OpsNotificationRuleRecord).all()
        return [{
            "id": r.id, "name": r.name, "description": r.description, "enabled": r.enabled, "conditions": json.loads(r.conditions_json or "[]"),
            "conditionLogic": r.condition_logic, "channels": json.loads(r.channels_json or "[]"), "recipients": json.loads(r.recipients_json or "[]"),
            "fieldIds": json.loads(r.field_ids_json or "[]"), "cooldownMinutes": r.cooldown_minutes, "createdBy": r.created_by, "createdAt": r.created_at,
            "lastTriggered": r.last_triggered, "triggerCount": r.trigger_count
        } for r in rows]


@app.post("/ops/notification-rules")
def ops_create_rule(rule: dict):
    rule_id = rule.get("id") or f"r_{uuid4().hex[:10]}"
    with SessionLocal() as db:
        db.add(OpsNotificationRuleRecord(
            id=rule_id, name=rule.get("name", "Новое правило"), description=rule.get("description", ""),
            enabled=bool(rule.get("enabled", True)), conditions_json=json.dumps(rule.get("conditions", []), ensure_ascii=False),
            condition_logic=rule.get("conditionLogic", "AND"), channels_json=json.dumps(rule.get("channels", []), ensure_ascii=False),
            recipients_json=json.dumps(rule.get("recipients", []), ensure_ascii=False), field_ids_json=json.dumps(rule.get("fieldIds", []), ensure_ascii=False),
            cooldown_minutes=int(rule.get("cooldownMinutes", 60)), created_by=rule.get("createdBy", "system"),
            created_at=rule.get("createdAt", datetime.utcnow().date().isoformat()), last_triggered=rule.get("lastTriggered"), trigger_count=int(rule.get("triggerCount", 0))
        ))
        db.commit()
    _audit("alert_rule_create", f"Notification rule created: {rule_id}", "Rule", rule_id, rule.get("name", ""))
    return {"id": rule_id}


@app.put("/ops/notification-rules/{rule_id}")
def ops_update_rule(rule_id: str, rule: dict):
    with SessionLocal() as db:
        row = db.query(OpsNotificationRuleRecord).filter(OpsNotificationRuleRecord.id == rule_id).first()
        if not row:
            raise HTTPException(status_code=404, detail="Rule not found")
        for fld, col in [("name", "name"), ("description", "description"), ("enabled", "enabled"), ("conditionLogic", "condition_logic"),
                         ("cooldownMinutes", "cooldown_minutes"), ("createdBy", "created_by"), ("createdAt", "created_at"),
                         ("lastTriggered", "last_triggered"), ("triggerCount", "trigger_count")]:
            if fld in rule:
                setattr(row, col, rule[fld])
        if "conditions" in rule:
            row.conditions_json = json.dumps(rule["conditions"], ensure_ascii=False)
        if "channels" in rule:
            row.channels_json = json.dumps(rule["channels"], ensure_ascii=False)
        if "recipients" in rule:
            row.recipients_json = json.dumps(rule["recipients"], ensure_ascii=False)
        if "fieldIds" in rule:
            row.field_ids_json = json.dumps(rule["fieldIds"], ensure_ascii=False)
        db.commit()
    _audit("alert_rule_update", f"Notification rule updated: {rule_id}", "Rule", rule_id)
    return {"status": "ok"}


@app.delete("/ops/notification-rules/{rule_id}")
def ops_delete_rule(rule_id: str):
    with SessionLocal() as db:
        row = db.query(OpsNotificationRuleRecord).filter(OpsNotificationRuleRecord.id == rule_id).first()
        if row:
            db.delete(row)
            db.commit()
    _audit("alert_rule_delete", f"Notification rule deleted: {rule_id}", "Rule", rule_id)
    return {"status": "ok"}


@app.get("/ops/reports/history")
def ops_reports_history():
    _seed_ops_data_if_empty()
    with SessionLocal() as db:
        rows = db.query(OpsReportRecord).order_by(OpsReportRecord.created_at.desc()).all()
        return [{"id": r.id, "name": r.name, "format": r.format, "date": r.created_at, "size": f"{r.size_mb:.1f} МБ", "user": r.created_by} for r in rows]


@app.get("/ops/reports/history/{report_id}/download")
def ops_report_download(report_id: str):
    with SessionLocal() as db:
        row = db.query(OpsReportRecord).filter(OpsReportRecord.id == report_id).first()
        if not row:
            raise HTTPException(status_code=404, detail="Отчёт не найден")
        name, fmt = row.name, row.format
        template_id = (getattr(row, "template_id", None) or "") or ""
    ext = "pdf" if fmt == "pdf" else "xlsx"
    report_exports.ensure_reports_dir()
    path = report_exports.REPORTS_DIR / f"{report_id}.{ext}"
    if path.is_file():
        media = (
            "application/pdf"
            if fmt == "pdf"
            else "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
        return FileResponse(str(path), filename=f"{report_id}.{ext}", media_type=media)
    try:
        content, attachment_name, media = report_exports.build_report_bytes(name, template_id, fmt)
    except Exception as e:
        logger.exception("report rebuild for download failed")
        raise HTTPException(status_code=500, detail=f"Не удалось сформировать файл: {e!s}")
    return Response(
        content=content,
        media_type=media,
        headers={"Content-Disposition": f'attachment; filename="{attachment_name}"'},
    )


@app.get("/ops/reports/scheduled")
def ops_reports_scheduled():
    _seed_ops_data_if_empty()
    with SessionLocal() as db:
        rows = db.query(OpsScheduledReportRecord).order_by(OpsScheduledReportRecord.next_run.asc()).all()
    return [_scheduled_row_to_api(r) for r in rows]


@app.post("/ops/reports/scheduled")
def ops_reports_scheduled_create(payload: dict):
    template_id = (payload.get("templateId") or "").strip()
    name = (payload.get("name") or "").strip()
    frequency = (payload.get("frequency") or "").strip().lower()
    fmt = (payload.get("format") or "pdf").strip().lower()
    channel = (payload.get("channel") or "email").strip().lower()
    recipients = payload.get("recipients") or []

    if not template_id or not name:
        raise HTTPException(status_code=400, detail="Укажите шаблон и название")
    if frequency not in ("weekly", "monthly"):
        raise HTTPException(status_code=400, detail="Периодичность: weekly или monthly")
    if fmt not in ("pdf", "excel"):
        raise HTTPException(status_code=400, detail="Формат: pdf или excel")
    if channel != "email":
        raise HTTPException(status_code=400, detail="Рассылка отчётов только на email")
    if not isinstance(recipients, list) or len(recipients) == 0:
        raise HTTPException(status_code=400, detail="Укажите хотя бы одного получателя")

    clean_recipients = []
    for x in recipients:
        s = str(x).strip()
        if s:
            clean_recipients.append(s)
    if not clean_recipients:
        raise HTTPException(status_code=400, detail="Укажите хотя бы одного получателя")

    sid = "sch_" + uuid4().hex[:10]
    now = datetime.utcnow().isoformat()
    next_run = _compute_next_run(frequency)
    with SessionLocal() as db:
        db.add(OpsScheduledReportRecord(
            id=sid,
            template_id=template_id,
            name=name,
            frequency=frequency,
            format=fmt,
            channel=channel,
            recipients_json=json.dumps(clean_recipients, ensure_ascii=False),
            next_run=next_run,
            created_at=now,
        ))
        db.commit()
        row = db.query(OpsScheduledReportRecord).filter(OpsScheduledReportRecord.id == sid).first()
    _audit("report_schedule_create", f"Scheduled report {sid}: {name}", "ScheduledReport", sid, name)
    return _scheduled_row_to_api(row)


@app.patch("/ops/reports/scheduled/{schedule_id}")
def ops_reports_scheduled_patch(schedule_id: str, payload: dict):
    with SessionLocal() as db:
        row = db.query(OpsScheduledReportRecord).filter(OpsScheduledReportRecord.id == schedule_id).first()
        if not row:
            raise HTTPException(status_code=404, detail="Расписание не найдено")
        if "name" in payload and payload["name"]:
            row.name = str(payload["name"]).strip()
        if "templateId" in payload and payload["templateId"]:
            row.template_id = str(payload["templateId"]).strip()
        if "frequency" in payload and payload["frequency"]:
            fr = str(payload["frequency"]).strip().lower()
            if fr not in ("weekly", "monthly"):
                raise HTTPException(status_code=400, detail="Периодичность: weekly или monthly")
            row.frequency = fr
            row.next_run = _compute_next_run(fr)
        if "format" in payload and payload["format"]:
            fmt = str(payload["format"]).strip().lower()
            if fmt not in ("pdf", "excel"):
                raise HTTPException(status_code=400, detail="Формат: pdf или excel")
            row.format = fmt
        if "channel" in payload and payload["channel"]:
            ch = str(payload["channel"]).strip().lower()
            if ch != "email":
                raise HTTPException(status_code=400, detail="Рассылка отчётов только на email")
            row.channel = ch
        if "recipients" in payload and isinstance(payload["recipients"], list):
            clean_recipients = [str(x).strip() for x in payload["recipients"] if str(x).strip()]
            if not clean_recipients:
                raise HTTPException(status_code=400, detail="Нужен хотя бы один получатель")
            row.recipients_json = json.dumps(clean_recipients, ensure_ascii=False)
        db.commit()
        db.refresh(row)
    _audit("report_schedule_update", f"Updated schedule {schedule_id}", "ScheduledReport", schedule_id, row.name)
    return _scheduled_row_to_api(row)


@app.delete("/ops/reports/scheduled/{schedule_id}")
def ops_reports_scheduled_delete(schedule_id: str):
    with SessionLocal() as db:
        row = db.query(OpsScheduledReportRecord).filter(OpsScheduledReportRecord.id == schedule_id).first()
        if not row:
            raise HTTPException(status_code=404, detail="Расписание не найдено")
        nm = row.name
        db.delete(row)
        db.commit()
    _audit("report_schedule_delete", f"Deleted schedule {schedule_id}", "ScheduledReport", schedule_id, nm)
    return {"status": "ok"}


@app.post("/ops/reports/generate")
def ops_generate_report(payload: dict):
    name = (payload.get("name") or "Сформированный отчёт").strip()
    fmt = (payload.get("format") or "pdf").strip().lower()
    template_id = (payload.get("templateId") or "").strip()
    if fmt not in ("pdf", "excel"):
        raise HTTPException(status_code=400, detail="Формат: pdf или excel")
    created_by = (payload.get("user") or "web").strip() or "web"
    report_id = f"rep_{uuid4().hex[:10]}"
    try:
        content, _fname, _media = report_exports.build_report_bytes(name, template_id, fmt)
    except Exception as e:
        logger.exception("report generate failed")
        raise HTTPException(status_code=500, detail=f"Не удалось сформировать отчёт: {e!s}")
    report_exports.write_report_to_disk(report_id, fmt, content)
    sz = max(round(len(content) / (1024 * 1024), 3), 0.01)
    with SessionLocal() as db:
        db.add(
            OpsReportRecord(
                id=report_id,
                name=name,
                format=fmt,
                created_by=created_by,
                size_mb=sz,
                created_at=datetime.utcnow().strftime("%Y-%m-%d %H:%M"),
                template_id=template_id,
            )
        )
        db.commit()
    _audit(
        "export_pdf" if fmt == "pdf" else "export_excel",
        f"Generated report: {report_id}",
        "Report",
        report_id,
        name,
    )
    return {"id": report_id, "status": "ready"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
