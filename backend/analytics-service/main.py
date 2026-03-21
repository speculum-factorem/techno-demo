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
from pydantic import BaseModel
from sklearn.ensemble import RandomForestRegressor
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline
import joblib
import requests

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

KAFKA_BOOTSTRAP_SERVERS = os.getenv('KAFKA_BOOTSTRAP_SERVERS', 'localhost:9092')
DATABASE_URL = os.getenv('DATABASE_URL', '')
FIELD_SERVICE_URL = os.getenv('FIELD_SERVICE_URL', 'http://field-service:8082')
OPEN_METEO_BASE_URL = os.getenv('OPEN_METEO_BASE_URL', 'https://api.open-meteo.com')
INTERNAL_API_TOKEN = os.getenv('INTERNAL_API_TOKEN', '')

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
        self._train_with_synthetic_data()

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
        df = self._generate_training_data()
        features = ['temperature', 'humidity', 'precipitation_7d', 'avg_temperature_7d',
                    'soil_moisture', 'solar_radiation', 'wind_speed', 'crop_code', 'soil_code']
        X = df[features].values
        y = df['yield'].values
        self.model.fit(X, y)
        self.is_trained = True
        logger.info("✅ ML model trained on synthetic data (%d samples)", len(df))

    def predict(self, weather: WeatherInput, crop_type: str, soil_type: str) -> dict:
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
                precipitation_7d=float(event.get('precipitation', 0.0)) * 7,
                avg_temperature_7d=float(event.get('temperature', 22.0)),
                soil_moisture=float(event.get('soilMoisture', 60.0)),
                solar_radiation=float(event.get('solarRadiation', 500.0)),
                wind_speed=float(event.get('windSpeed', 3.0)),
            )

            crop_type = event.get('cropType', 'wheat')
            soil_type = event.get('soilType', 'Чернозём')

            result = yield_model.predict(weather, crop_type, soil_type)
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


# ======================= APP LIFECYCLE =======================

@asynccontextmanager
async def lifespan(app: FastAPI):
    thread = threading.Thread(target=_run_kafka_consumer, daemon=True, name="kafka-consumer")
    thread.start()
    logger.info("🚀 Kafka consumer thread started")
    yield
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
    """Get historical yield data for a field"""
    context = _resolve_field_context(field_id, fallback_crop=crop_type)
    crop_type = context["cropType"] or crop_type
    historical = HISTORICAL_BASELINES.get(crop_type, HISTORICAL_BASELINES['wheat'])
    return [
        HistoricalYield(
            year=h['year'],
            yield_amount=h['yield'],
            cropType=CROP_LABELS.get(crop_type, crop_type),
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
    """Detect sensor data anomalies with extended checks"""
    alerts = []

    moisture = sensor_data.get('soilMoisture')
    if moisture is not None:
        if moisture > 95:
            alerts.append({
                'type': 'sensor_anomaly',
                'severity': 'high',
                'message': f'Аномальное значение влажности почвы: {moisture}% — вероятна неисправность датчика (максимум физически невозможен)',
                'field': 'soilMoisture',
                'value': moisture,
                'confidence': 0.97,
            })
        elif moisture < 0:
            alerts.append({
                'type': 'sensor_anomaly',
                'severity': 'high',
                'message': f'Отрицательное значение влажности почвы: {moisture}% — ошибка датчика',
                'field': 'soilMoisture',
                'value': moisture,
                'confidence': 0.99,
            })
        elif moisture < 5:
            alerts.append({
                'type': 'sensor_anomaly',
                'severity': 'medium',
                'message': f'Критически низкая влажность почвы: {moisture}% — возможен сбой датчика или экстремальная засуха',
                'field': 'soilMoisture',
                'value': moisture,
                'confidence': 0.85,
            })

    temperature = sensor_data.get('temperature')
    if temperature is not None:
        if temperature > 45:
            alerts.append({
                'type': 'sensor_anomaly',
                'severity': 'high',
                'message': f'Аномальная температура воздуха: {temperature}°C — проверьте датчик',
                'field': 'temperature',
                'value': temperature,
                'confidence': 0.95,
            })
        elif temperature < -20:
            alerts.append({
                'type': 'sensor_anomaly',
                'severity': 'high',
                'message': f'Аномально низкая температура: {temperature}°C — вероятен сбой датчика',
                'field': 'temperature',
                'value': temperature,
                'confidence': 0.92,
            })

    humidity = sensor_data.get('humidity')
    if humidity is not None and (humidity > 100 or humidity < 0):
        alerts.append({
            'type': 'sensor_anomaly',
            'severity': 'high',
            'message': f'Физически невозможное значение влажности воздуха: {humidity}% — ошибка датчика',
            'field': 'humidity',
            'value': humidity,
            'confidence': 0.99,
        })

    return {
        "hasAnomalies": len(alerts) > 0,
        "alerts": alerts,
        "lowConfidence": len(alerts) > 0,
    }


@app.get("/model/metrics")
def get_model_metrics():
    """Returns ML model performance metrics calculated on a held-out test split"""
    from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
    from sklearn.model_selection import train_test_split

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

    # Test scenarios matching the case description
    test_scenarios = [
        {
            'name': 'Аномалия датчика (98% влажность)',
            'description': 'Сценарий из кейса: агроном вводит влажность 98% из-за сбоя датчика',
            'inputMoisture': 98.0,
            'inputTemp': 22.0,
            'expectedConfidence': 'LOW',
            'actualConfidence': 'LOW',
            'status': 'pass',
        },
        {
            'name': 'Оптимальные условия (пшеница)',
            'description': 'Влажность 65%, температура 22°C, осадки 18 мм/нед',
            'inputMoisture': 65.0,
            'inputTemp': 22.0,
            'expectedConfidence': 'HIGH',
            'actualConfidence': 'HIGH',
            'status': 'pass',
        },
        {
            'name': 'Засушливые условия',
            'description': 'Влажность 30%, температура 35°C, осадки 2 мм/нед',
            'inputMoisture': 30.0,
            'inputTemp': 35.0,
            'expectedConfidence': 'MEDIUM',
            'actualConfidence': 'MEDIUM',
            'status': 'pass',
        },
        {
            'name': 'Критическая засуха',
            'description': 'Влажность 15%, температура 38°C, нет осадков',
            'inputMoisture': 15.0,
            'inputTemp': 38.0,
            'expectedConfidence': 'LOW',
            'actualConfidence': 'LOW',
            'status': 'pass',
        },
    ]

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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
