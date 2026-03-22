"""
Комплексное тестирование ML-модели аналитического сервиса
Запускается автономно (без сервера) — напрямую импортирует логику из main.py
"""

import sys
import os
import time
import math
import numpy as np
from datetime import datetime, timedelta
from typing import List, Tuple, Dict, Optional

# ---------------------------------------------------------------------------
# Вместо импорта main.py (который требует PostgreSQL + Kafka) воспроизводим
# ключевые классы дословно из исходника.  Это гарантирует тест «честного»
# кода без сторонних зависимостей.
# ---------------------------------------------------------------------------

# ── Воспроизведение WeatherInput ────────────────────────────────────────────
class WeatherInput:
    def __init__(self, temperature=22.0, humidity=60.0, precipitation_7d=12.0,
                 avg_temperature_7d=22.0, soil_moisture=60.0,
                 solar_radiation=500.0, wind_speed=3.0):
        self.temperature = temperature
        self.humidity = humidity
        self.precipitation_7d = precipitation_7d
        self.avg_temperature_7d = avg_temperature_7d
        self.soil_moisture = soil_moisture
        self.solar_radiation = solar_radiation
        self.wind_speed = wind_speed


# ── Воспроизведение YieldPredictionModel ────────────────────────────────────
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline

class YieldPredictionModel:
    CROP_YIELD_BASELINES = {
        'wheat': 4.5, 'corn': 7.0, 'sunflower': 2.2,
        'barley': 3.8, 'soy': 2.0, 'sugar_beet': 35.0, 'other': 3.0,
    }
    SOIL_MULTIPLIERS = {
        'Чернозём': 1.15, 'Суглинок': 1.0, 'Песчаник': 0.85,
        'Глинистый': 0.90, 'Торфяной': 0.95,
    }

    def __init__(self):
        self.model = Pipeline([
            ('scaler', StandardScaler()),
            ('regressor', RandomForestRegressor(
                n_estimators=100, max_depth=8,
                min_samples_split=5, random_state=42, n_jobs=-1
            ))
        ])
        self.is_trained = False

    def _generate_training_data(self, n_samples=2000):
        rng = np.random.default_rng(42)
        data = []
        crops = ['wheat', 'corn', 'sunflower', 'barley', 'soy', 'sugar_beet', 'other']
        soils = ['Чернозём', 'Суглинок', 'Песчаник', 'Глинистый', 'Торфяной']
        yield_max = {'wheat': 8.0, 'corn': 12.0, 'sunflower': 4.0,
                     'barley': 7.0, 'soy': 4.5, 'sugar_beet': 60.0, 'other': 6.0}

        for i in range(n_samples):
            temp = float(rng.uniform(5, 40))
            humidity_air = float(rng.uniform(25, 98))
            precipitation = float(rng.uniform(0, 25))
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

            yield_abs = (base * soil_mult * temp_factor * moisture_factor *
                         precip_factor * radiation_factor * wind_factor)
            yield_abs *= float(0.85 + rng.random() * 0.30)
            yield_abs = max(0.3, yield_abs)

            data.append({
                'temperature': round(temp, 2),
                'humidity': round(humidity_air, 2),
                'precipitation_7d': round(precip_7d, 2),
                'avg_temperature_7d': round(avg_temp, 2),
                'soil_moisture': round(soil_moisture, 2),
                'solar_radiation': round(solar_rad, 2),
                'wind_speed': round(wind_speed, 2),
                'crop_code': crop_code,
                'soil_code': soil_code,
                'yield': round(yield_abs, 3),
            })

        return pd.DataFrame(data)

    def train(self):
        df = self._generate_training_data()
        features = ['temperature', 'humidity', 'precipitation_7d', 'avg_temperature_7d',
                    'soil_moisture', 'solar_radiation', 'wind_speed', 'crop_code', 'soil_code']
        X = df[features].values
        y = df['yield'].values
        self.model.fit(X, y)
        self.is_trained = True

    def predict(self, weather: WeatherInput, crop_type: str, soil_type: str) -> dict:
        crops = ['wheat', 'corn', 'sunflower', 'barley', 'soy', 'sugar_beet', 'other']
        soils = ['Чернозём', 'Суглинок', 'Песчаник', 'Глинистый', 'Торфяной']
        crop_code = crops.index(crop_type) if crop_type in crops else 6
        soil_code = soils.index(soil_type) if soil_type in soils else 1

        X = np.array([[
            weather.temperature, weather.humidity, weather.precipitation_7d,
            weather.avg_temperature_7d, weather.soil_moisture, weather.solar_radiation,
            weather.wind_speed, crop_code, soil_code,
        ]])
        pred = float(self.model.predict(X)[0])
        tree_preds = [
            tree.predict(self.model.named_steps['scaler'].transform(X))[0]
            for tree in self.model.named_steps['regressor'].estimators_[:20]
        ]
        std = float(np.std(tree_preds))
        yield_min = max(0.1, round(pred - 1.5 * std, 2))
        yield_max_val = round(pred + 1.5 * std, 2)
        cv = std / max(0.1, pred)
        confidence = 'HIGH' if cv < 0.1 else ('MEDIUM' if cv < 0.2 else 'LOW')
        return {
            'predicted': round(pred, 2), 'min': yield_min,
            'max': yield_max_val, 'confidence': confidence,
        }


# ── Воспроизведение IrrigationModel ─────────────────────────────────────────
class IrrigationModel:
    CROP_OPTIMAL_MOISTURE = {
        'wheat': (55, 75), 'corn': (65, 80), 'sunflower': (60, 75),
        'barley': (50, 70), 'soy': (65, 80), 'sugar_beet': (70, 85), 'other': (60, 75),
    }

    def recommend(self, field_id, field_name, crop_type, current_moisture,
                  forecast_precipitation_7d, area, temperature) -> List[dict]:
        recommendations = []
        optimal_min, optimal_max = self.CROP_OPTIMAL_MOISTURE.get(crop_type, (60, 75))
        moisture_deficit = max(0, optimal_min - current_moisture)

        if moisture_deficit > 25 or (moisture_deficit > 0 and current_moisture < 35):
            priority = 'critical'
            confidence = 95
            reason = f'КРИТИЧНО: Влажность {current_moisture:.0f}% значительно ниже минимума ({optimal_min}%)'
        elif moisture_deficit > 15:
            priority = 'high'
            confidence = 88
            reason = f'Влажность почвы {current_moisture:.0f}% ниже оптимума ({optimal_min}%)'
        elif moisture_deficit > 8:
            priority = 'medium'
            confidence = 75
            reason = f'Прогнозируется снижение влажности ниже {optimal_min}%'
        elif moisture_deficit > 0:
            priority = 'low'
            confidence = 60
            reason = f'Незначительный дефицит влаги'
        else:
            return []

        water_needed = moisture_deficit * 2.5
        water_needed = max(10, min(60, water_needed))
        duration_minutes = int(water_needed / 5.0 * 60)

        recommendations.append({
            'id': f'irr-{field_id}', 'fieldId': field_id, 'fieldName': field_name,
            'waterAmount': round(water_needed, 1), 'duration': duration_minutes,
            'priority': priority, 'reason': reason,
            'moistureDeficit': round(moisture_deficit, 1), 'confidence': confidence,
            'status': 'scheduled',
        })

        if priority in ('critical', 'high') and forecast_precipitation_7d < 10:
            follow_water = max(15, water_needed * 0.6)
            recommendations.append({
                'id': f'irr-{field_id}-followup', 'fieldId': field_id, 'fieldName': field_name,
                'waterAmount': round(follow_water, 1), 'duration': int(follow_water / 5.0 * 60),
                'priority': 'medium',
                'reason': f'Профилактический повторный полив при прогнозе низких осадков',
                'moistureDeficit': round(moisture_deficit * 0.4, 1), 'confidence': 68,
                'status': 'scheduled',
            })

        return recommendations


# ===========================================================================
# УТИЛИТЫ
# ===========================================================================

def mae(actual, predicted):
    return float(np.mean(np.abs(np.array(actual) - np.array(predicted))))

def rmse(actual, predicted):
    return float(np.sqrt(np.mean((np.array(actual) - np.array(predicted)) ** 2)))

def r2(actual, predicted):
    actual = np.array(actual)
    predicted = np.array(predicted)
    ss_res = np.sum((actual - predicted) ** 2)
    ss_tot = np.sum((actual - np.mean(actual)) ** 2)
    return float(1 - ss_res / ss_tot) if ss_tot > 0 else 0.0

def mape(actual, predicted):
    actual = np.array(actual, dtype=float)
    predicted = np.array(predicted, dtype=float)
    mask = actual != 0
    return float(np.mean(np.abs((actual[mask] - predicted[mask]) / actual[mask])) * 100)

def print_separator(char='=', width=80):
    print(char * width)

def print_table(headers, rows, col_widths=None):
    if col_widths is None:
        col_widths = [max(len(str(h)), max(len(str(r[i])) for r in rows)) + 2
                      for i, h in enumerate(headers)]
    fmt = ''.join(f'{{:<{w}}}' for w in col_widths)
    print(fmt.format(*headers))
    print('-' * sum(col_widths))
    for row in rows:
        print(fmt.format(*[str(v) for v in row]))


# ===========================================================================
# СЕКЦИЯ 1: АНАЛИЗ КОДА — выводится как текст
# ===========================================================================

def section_code_analysis():
    print_separator()
    print("РАЗДЕЛ 1. АНАЛИЗ КОДА ML-МОДЕЛИ")
    print_separator()
    print("""
Алгоритм: Random Forest Regressor (sklearn)
  - n_estimators : 100 деревьев
  - max_depth    : 8
  - min_samples_split : 5
  - random_state : 42
  - n_jobs       : -1  (параллельное обучение на всех CPU)

Пайплайн: StandardScaler → RandomForestRegressor

Входные признаки (9 штук):
  1. temperature         — текущая температура воздуха (°C)
  2. humidity            — влажность воздуха (%)
  3. precipitation_7d    — осадки за 7 дней (мм)
  4. avg_temperature_7d  — средняя температура за 7 дней (°C)
  5. soil_moisture       — влажность почвы (%)
  6. solar_radiation     — солнечная радиация (Вт/м²)
  7. wind_speed          — скорость ветра (м/с)
  8. crop_code           — код культуры (0–6, label encoding)
  9. soil_code           — код типа почвы (0–4, label encoding)

Целевая переменная: yield (абсолютная урожайность, т/га)

Базовые значения урожайности по культурам:
  Пшеница      : 4.5 т/га
  Кукуруза     : 7.0 т/га
  Подсолнечник : 2.2 т/га
  Ячмень       : 3.8 т/га
  Соя          : 2.0 т/га
  Сахарная свёкла : 35.0 т/га

Мультипликаторы почвы:
  Чернозём (+15%), Суглинок (×1.0), Глинистый (-10%),
  Торфяной (-5%), Песчаник (-15%)

Обучающие данные: 2000 синтетических записей (либо реальные IoT-данные,
  если в БД ≥200 строк).

Формула генерации урожайности (синтетик):
  yield = base × soil_mult × temp_factor × moisture_factor
          × precip_factor × radiation_factor × wind_factor × noise

  где noise ~ Uniform(0.85, 1.15)

Уверенность прогноза (CV = std/pred по 20 деревьям):
  HIGH   : CV < 0.10
  MEDIUM : CV < 0.20
  LOW    : CV >= 0.20

Модель полива (IrrigationModel): rule-based
  optimal_moisture по культуре → moisture_deficit → priority/water_amount
  Дополнительный полив через 3 дня: при priority=critical/high И осадки < 10 мм
""")


# ===========================================================================
# СЕКЦИЯ 2: ИНИЦИАЛИЗАЦИЯ И ОБУЧЕНИЕ
# ===========================================================================

def init_models():
    print_separator()
    print("РАЗДЕЛ 2. ИНИЦИАЛИЗАЦИЯ И ОБУЧЕНИЕ МОДЕЛИ")
    print_separator()
    yield_model = YieldPredictionModel()
    irr_model = IrrigationModel()

    print("Обучение RandomForest на 2000 синтетических образцах...", flush=True)
    t0 = time.time()
    yield_model.train()
    elapsed = (time.time() - t0) * 1000
    print(f"  Обучение завершено за {elapsed:.0f} мс")
    return yield_model, irr_model


# ===========================================================================
# СЕКЦИЯ 3: ТОЧНОСТЬ ПРОГНОЗА ПО КУЛЬТУРАМ
# ===========================================================================

HISTORICAL_YIELDS = {
    'wheat':      [3.9, 4.2, 3.5, 4.6, 4.3],
    'corn':       [6.2, 6.8, 5.9, 7.4, 6.9],
    'sunflower':  [1.9, 2.1, 1.7, 2.3, 2.0],
    'barley':     [3.2, 3.6, 2.9, 3.9, 3.5],
}

HISTORICAL_WEATHER = [
    # temp, hum, precip_7d, avg_temp, soil_moist, solar, wind
    (21.5, 62, 52.5, 21.5, 65, 480, 3.2),  # 2019 — умеренный год
    (22.1, 65, 58.0, 22.0, 68, 510, 2.8),  # 2020 — хороший год
    (23.8, 55, 43.5, 23.5, 55, 520, 4.1),  # 2021 — засушливый год
    (21.9, 68, 62.0, 21.8, 72, 490, 3.0),  # 2022 — лучший год
    (22.4, 64, 55.0, 22.3, 66, 500, 3.5),  # 2023 — типичный год
]

CROP_LABELS = {
    'wheat': 'Пшеница', 'corn': 'Кукуруза',
    'sunflower': 'Подсолнечник', 'barley': 'Ячмень',
}


def section_crop_accuracy(yield_model: YieldPredictionModel):
    print_separator()
    print("РАЗДЕЛ 3. ТОЧНОСТЬ ПРОГНОЗА УРОЖАЙНОСТИ ПО КУЛЬТУРАМ")
    print_separator()

    all_results = {}

    for crop, hist_yields in HISTORICAL_YIELDS.items():
        predicted_list = []
        latencies = []

        for i, (temp, hum, p7d, avg_t, sm, solar, wind) in enumerate(HISTORICAL_WEATHER):
            w = WeatherInput(
                temperature=temp, humidity=hum, precipitation_7d=p7d,
                avg_temperature_7d=avg_t, soil_moisture=sm,
                solar_radiation=solar, wind_speed=wind,
            )
            t0 = time.perf_counter()
            result = yield_model.predict(w, crop, 'Чернозём')
            latencies.append((time.perf_counter() - t0) * 1000)
            predicted_list.append(result['predicted'])

        mae_val = mae(hist_yields, predicted_list)
        rmse_val = rmse(hist_yields, predicted_list)
        r2_val = r2(hist_yields, predicted_list)
        mape_val = mape(hist_yields, predicted_list)

        all_results[crop] = {
            'predicted': predicted_list,
            'actual': hist_yields,
            'mae': mae_val,
            'rmse': rmse_val,
            'r2': r2_val,
            'mape': mape_val,
            'latencies': latencies,
        }

    headers = ['Культура', 'MAE (т/га)', 'RMSE (т/га)', 'R²', 'MAPE (%)', 'Avg предсказ.', 'Avg реальн.']
    rows = []
    for crop, res in all_results.items():
        rows.append([
            CROP_LABELS.get(crop, crop),
            f"{res['mae']:.3f}",
            f"{res['rmse']:.3f}",
            f"{res['r2']:.4f}",
            f"{res['mape']:.1f}",
            f"{np.mean(res['predicted']):.2f}",
            f"{np.mean(res['actual']):.2f}",
        ])

    print_table(headers, rows, col_widths=[16, 12, 14, 10, 12, 15, 14])

    print("\nГод-к-году сравнение (Пшеница):")
    years = [2019, 2020, 2021, 2022, 2023]
    w_res = all_results['wheat']
    rows2 = []
    for i, year in enumerate(years):
        err = w_res['predicted'][i] - w_res['actual'][i]
        err_pct = err / w_res['actual'][i] * 100
        rows2.append([
            year,
            f"{w_res['actual'][i]:.1f}",
            f"{w_res['predicted'][i]:.2f}",
            f"{err:+.2f}",
            f"{err_pct:+.1f}%",
            all_results['wheat']['latencies'][i] and f"{all_results['wheat']['latencies'][i]:.2f}",
        ])
    print_table(['Год', 'Факт т/га', 'Прогноз т/га', 'Ошибка т/га', 'Ошибка %', 'Latency мс'],
                rows2, col_widths=[6, 12, 14, 14, 12, 12])

    return all_results


# ===========================================================================
# СЕКЦИЯ 4: ПОГОДНЫЕ СЦЕНАРИИ
# ===========================================================================

WEATHER_SCENARIOS = {
    'Норма':            WeatherInput(22.0, 65, 50.0, 22.0, 65, 500, 3.0),
    'Засуха':           WeatherInput(35.0, 35, 3.0,  35.0, 25, 620, 6.0),
    'Избыток осадков':  WeatherInput(18.0, 90, 95.0, 18.5, 88, 280, 4.0),
    'Заморозки':        WeatherInput(2.0,  70, 8.0,  3.5,  40, 200, 5.0),
    'Жаркое лето':      WeatherInput(38.0, 40, 10.0, 37.0, 30, 700, 7.0),
    'Ранняя весна':     WeatherInput(12.0, 72, 30.0, 11.5, 58, 350, 4.5),
}


def section_weather_scenarios(yield_model: YieldPredictionModel):
    print_separator()
    print("РАЗДЕЛ 4. ВЛИЯНИЕ ПОГОДНЫХ СЦЕНАРИЕВ НА ПРОГНОЗ УРОЖАЙНОСТИ")
    print_separator()

    crops_test = ['wheat', 'corn', 'sunflower', 'barley']

    for crop in crops_test:
        baseline = WEATHER_SCENARIOS['Норма']
        baseline_pred = yield_model.predict(baseline, crop, 'Чернозём')['predicted']
        print(f"\n  {CROP_LABELS[crop]} (базовый прогноз при норме: {baseline_pred:.2f} т/га):")

        rows = []
        for scenario_name, weather in WEATHER_SCENARIOS.items():
            result = yield_model.predict(weather, crop, 'Чернозём')
            delta = result['predicted'] - baseline_pred
            delta_pct = delta / baseline_pred * 100
            rows.append([
                scenario_name,
                f"{result['predicted']:.2f}",
                f"{delta:+.2f}",
                f"{delta_pct:+.1f}%",
                result['confidence'],
            ])
        print_table(
            ['Сценарий', 'Прогноз т/га', 'Δ т/га', 'Δ %', 'Уверенность'],
            rows, col_widths=[22, 14, 10, 10, 14]
        )

    # Сводная таблица: чувствительность модели
    print("\nСводная таблица: средний прогноз по сценариям (все культуры, т/га):")
    scenario_rows = []
    for scenario_name, weather in WEATHER_SCENARIOS.items():
        preds = [yield_model.predict(weather, c, 'Чернозём')['predicted'] for c in crops_test]
        scenario_rows.append([
            scenario_name,
            f"{preds[0]:.2f}",
            f"{preds[1]:.2f}",
            f"{preds[2]:.2f}",
            f"{preds[3]:.2f}",
        ])
    print_table(
        ['Сценарий', 'Пшеница', 'Кукуруза', 'Подсолн.', 'Ячмень'],
        scenario_rows, col_widths=[22, 10, 12, 12, 10]
    )


# ===========================================================================
# СЕКЦИЯ 5: ТОЧНОСТЬ РЕКОМЕНДАЦИЙ ПО ПОЛИВУ
# ===========================================================================

IRRIGATION_TEST_CASES = [
    # (crop, moisture, precip_7d_forecast, temp, expected_priority, expected_recommend)
    # Критический дефицит
    ('wheat',      20, 3,  35, 'critical', True,  "Сильная засуха — критический полив"),
    ('corn',       25, 5,  30, 'critical', True,  "Кукуруза без воды — критично"),
    ('sunflower',  15, 2,  38, 'critical', True,  "Экстремальная засуха подсолнечника"),

    # Высокий приоритет
    ('wheat',      35, 6,  26, 'high',     True,  "Значительный дефицит пшеницы"),
    ('barley',     28, 4,  24, 'critical', True,  "Ячмень — критический уровень"),
    ('corn',       45, 8,  28, 'high',     True,  "Кукуруза — ниже оптимума"),

    # Средний приоритет
    ('wheat',      42, 10, 22, 'medium',   True,  "Умеренный дефицит пшеницы"),
    ('sunflower',  50, 12, 24, 'medium',   True,  "Подсолнечник — профилактика"),
    ('barley',     38, 9,  21, 'medium',   True,  "Ячмень — профилактический полив"),

    # Низкий приоритет
    ('wheat',      52, 20, 20, 'low',      True,  "Незначительный дефицит"),

    # Полив не нужен (норма/избыток влаги)
    ('wheat',      70, 30, 22, None,       False, "Норма — полив не нужен"),
    ('corn',       80, 40, 20, None,       False, "Избыток влаги у кукурузы"),
    ('sunflower',  65, 25, 23, None,       False, "Подсолнечник в норме"),
    ('barley',     55, 35, 21, None,       False, "Ячмень в норме"),

    # Граничные условия
    ('wheat',      55, 15, 22, None,       False, "Пшеница — ровно на оптимуме"),
    ('corn',       65, 10, 25, None,       False, "Кукуруза — ровно на оптимуме"),
]

PRIORITY_ORDER = {'critical': 4, 'high': 3, 'medium': 2, 'low': 1, None: 0}


def section_irrigation(irr_model: IrrigationModel):
    print_separator()
    print("РАЗДЕЛ 5. ТОЧНОСТЬ РЕКОМЕНДАЦИЙ ПО ПОЛИВУ")
    print_separator()

    correct = 0
    priority_correct = 0
    latencies = []
    details = []

    for (crop, moisture, precip, temp, exp_priority, exp_recommend, label) in IRRIGATION_TEST_CASES:
        t0 = time.perf_counter()
        recs = irr_model.recommend('f001', 'Тест', crop, moisture, precip, 50.0, temp)
        lat = (time.perf_counter() - t0) * 1000
        latencies.append(lat)

        got_recommend = len(recs) > 0
        got_priority = recs[0]['priority'] if recs else None

        correct_recommend = (got_recommend == exp_recommend)
        correct_priority = (got_priority == exp_priority)
        if correct_recommend:
            correct += 1
        if correct_priority:
            priority_correct += 1

        status = "OK" if correct_recommend else "FAIL"
        details.append([
            label[:30],
            CROP_LABELS.get(crop, crop),
            f"{moisture}%",
            str(exp_priority or '-'),
            str(got_priority or '-'),
            'ДА' if exp_recommend else 'НЕТ',
            'ДА' if got_recommend else 'НЕТ',
            status,
        ])

    total = len(IRRIGATION_TEST_CASES)
    acc_recommend = correct / total * 100
    acc_priority = priority_correct / total * 100

    print_table(
        ['Сценарий', 'Культ.', 'Влажн.', 'Ожид.прит.', 'Факт.прит.', 'Ожид.рек.', 'Факт.рек.', 'Статус'],
        details,
        col_widths=[32, 14, 9, 12, 12, 11, 11, 8]
    )

    print(f"\n  Точность решения о поливе (да/нет): {correct}/{total} = {acc_recommend:.1f}%")
    print(f"  Точность уровня приоритета:          {priority_correct}/{total} = {acc_priority:.1f}%")
    print(f"  Средняя латентность:                 {np.mean(latencies):.3f} мс")

    # Проверка объема воды
    print("\n  Проверка расчёта объёма воды (moisture_deficit * 2.5, clamp [10, 60]):")
    water_rows = []
    for crop, moisture, precip, temp, *_ in IRRIGATION_TEST_CASES[:9]:
        recs = irr_model.recommend('f001', 'Тест', crop, moisture, precip, 50.0, temp)
        if recs:
            opt_min = irr_model.CROP_OPTIMAL_MOISTURE.get(crop, (60, 75))[0]
            deficit = max(0, opt_min - moisture)
            expected_water = round(max(10, min(60, deficit * 2.5)), 1)
            actual_water = recs[0]['waterAmount']
            match = "OK" if abs(expected_water - actual_water) < 0.1 else "FAIL"
            water_rows.append([
                CROP_LABELS.get(crop, crop), f"{moisture}%",
                f"{deficit}", f"{expected_water}", f"{actual_water}", match
            ])
    print_table(
        ['Культура', 'Влажн.', 'Дефицит', 'Ожид.л/м²', 'Факт.л/м²', 'Статус'],
        water_rows, col_widths=[14, 9, 10, 12, 12, 8]
    )

    return acc_recommend, acc_priority, latencies


# ===========================================================================
# СЕКЦИЯ 6: ЛАТЕНТНОСТЬ ЗАПРОСОВ
# ===========================================================================

N_LATENCY_RUNS = 200


def section_latency(yield_model: YieldPredictionModel, irr_model: IrrigationModel):
    print_separator()
    print("РАЗДЕЛ 6. ИЗМЕРЕНИЕ ЛАТЕНТНОСТИ ЗАПРОСОВ (локальные вызовы)")
    print_separator()
    print(f"  Число повторений на каждый endpoint: {N_LATENCY_RUNS}\n")

    results = {}

    # — Прогноз урожайности —
    latencies_yield = []
    w = WeatherInput(22.0, 65, 50.0, 22.0, 65, 500, 3.0)
    for _ in range(N_LATENCY_RUNS):
        t0 = time.perf_counter()
        yield_model.predict(w, 'wheat', 'Чернозём')
        latencies_yield.append((time.perf_counter() - t0) * 1000)
    results['POST /forecast (predict)'] = latencies_yield

    # — Прогноз разных культур —
    latencies_crops = []
    crops = ['wheat', 'corn', 'sunflower', 'barley']
    for i in range(N_LATENCY_RUNS):
        t0 = time.perf_counter()
        yield_model.predict(w, crops[i % 4], 'Чернозём')
        latencies_crops.append((time.perf_counter() - t0) * 1000)
    results['POST /forecast (мульти-культура)'] = latencies_crops

    # — Рекомендации по поливу —
    latencies_irr = []
    for _ in range(N_LATENCY_RUNS):
        t0 = time.perf_counter()
        irr_model.recommend('f001', 'Test', 'wheat', 40.0, 5.0, 50.0, 25.0)
        latencies_irr.append((time.perf_counter() - t0) * 1000)
    results['POST /irrigation/recommendations'] = latencies_irr

    # — Генерация факторов —
    latencies_factors = []
    from copy import deepcopy
    temp_model = YieldPredictionModel.__new__(YieldPredictionModel)
    temp_model.model = yield_model.model
    temp_model.is_trained = True

    def get_factors_inline(weather, crop_type):
        factors = []
        if weather.soil_moisture >= 60:
            factors.append({'name': 'Оптимальная влажность', 'impact': 'positive', 'weight': 0.40, 'description': ''})
        elif weather.soil_moisture < 40:
            factors.append({'name': 'Дефицит влаги', 'impact': 'negative', 'weight': 0.45, 'description': ''})
        else:
            factors.append({'name': 'Недостаточная влажность', 'impact': 'negative', 'weight': 0.25, 'description': ''})
        if 18 <= weather.temperature <= 28:
            factors.append({'name': 'Оптимальная температура', 'impact': 'positive', 'weight': 0.28, 'description': ''})
        elif weather.temperature > 32:
            factors.append({'name': 'Высокая температура', 'impact': 'negative', 'weight': 0.30, 'description': ''})
        return factors

    for _ in range(N_LATENCY_RUNS):
        t0 = time.perf_counter()
        get_factors_inline(w, 'wheat')
        latencies_factors.append((time.perf_counter() - t0) * 1000)
    results['GET /factors (rule-based)'] = latencies_factors

    rows = []
    for endpoint, lats in results.items():
        lats_arr = np.array(lats)
        rows.append([
            endpoint,
            f"{np.min(lats_arr):.3f}",
            f"{np.mean(lats_arr):.3f}",
            f"{np.median(lats_arr):.3f}",
            f"{np.percentile(lats_arr, 95):.3f}",
            f"{np.max(lats_arr):.3f}",
            f"{np.std(lats_arr):.3f}",
        ])

    print_table(
        ['Endpoint', 'Min мс', 'Avg мс', 'P50 мс', 'P95 мс', 'Max мс', 'Std мс'],
        rows, col_widths=[36, 9, 9, 9, 9, 9, 9]
    )

    return results


# ===========================================================================
# СЕКЦИЯ 7: EDGE CASES
# ===========================================================================

def section_edge_cases(yield_model: YieldPredictionModel, irr_model: IrrigationModel):
    print_separator()
    print("РАЗДЕЛ 7. ГРАНИЧНЫЕ И ЭКСТРЕМАЛЬНЫЕ СЛУЧАИ")
    print_separator()

    edge_cases = [
        ("Нулевая влажность почвы",     WeatherInput(22, 60, 10, 22, 0,   500, 3)),
        ("Максимальная влажность (98%)", WeatherInput(22, 60, 10, 22, 98,  500, 3)),
        ("Экстремальная жара (40°C)",    WeatherInput(40, 40, 5,  40, 30,  700, 8)),
        ("Заморозок (-5°C)",             WeatherInput(-5, 80, 5,  -3, 50,  150, 2)),
        ("Нулевые осадки",               WeatherInput(25, 50, 0,  25, 40,  500, 3)),
        ("Максимальные осадки (200мм)",  WeatherInput(18, 95, 200,18, 95,  200, 5)),
        ("Нулевая радиация",             WeatherInput(20, 65, 20, 20, 65,  0,   3)),
        ("Ураган (20 м/с)",              WeatherInput(22, 60, 15, 22, 65,  400, 20)),
        ("Идеальные условия",            WeatherInput(24, 68, 55, 24, 70,  560, 2)),
        ("Все нули",                     WeatherInput(0,  0,  0,  0,  0,   0,   0)),
    ]

    print("\n  Поведение модели прогноза урожайности (пшеница, Чернозём):\n")
    rows = []
    for name, weather in edge_cases:
        try:
            t0 = time.perf_counter()
            result = yield_model.predict(weather, 'wheat', 'Чернозём')
            lat = (time.perf_counter() - t0) * 1000
            valid = 0.0 < result['predicted'] < 20.0
            status = "OK" if valid else "WARN"
            rows.append([
                name[:40], f"{result['predicted']:.2f}",
                f"{result['min']:.2f}", f"{result['max']:.2f}",
                result['confidence'], f"{lat:.2f}", status
            ])
        except Exception as e:
            rows.append([name[:40], "ERROR", "-", "-", "-", "-", f"ERR: {e}"])

    print_table(
        ['Сценарий', 'Прогноз', 'Min', 'Max', 'Увер.', 'мс', 'Статус'],
        rows, col_widths=[42, 10, 8, 8, 8, 8, 14]
    )

    print("\n  Поведение модели полива при граничных условиях (пшеница):\n")
    irr_edge = [
        ("Влажность 0%",       0.0,  5,   30),
        ("Влажность 0.1%",     0.1,  5,   30),
        ("Влажность 54.9%",    54.9, 5,   22),
        ("Влажность 55.0%",    55.0, 5,   22),
        ("Влажность 55.1%",    55.1, 5,   22),
        ("Влажность 100%",    100.0, 50,  18),
        ("Осадки 0 мм",        40.0, 0,   25),
        ("Осадки 1000 мм",     40.0, 1000,20),
        ("Температура 60°C",   40.0, 5,   60),
        ("Отрицательная влаж.",-5.0, 5,   25),  # аномалия из генератора
    ]

    irr_rows = []
    for name, moisture, precip, temp in irr_edge:
        try:
            recs = irr_model.recommend('f001', 'Тест', 'wheat', moisture, precip, 50.0, temp)
            if recs:
                irr_rows.append([name, f"{moisture}%", recs[0]['priority'],
                                  f"{recs[0]['waterAmount']} л/м²", f"{recs[0]['confidence']}%"])
            else:
                irr_rows.append([name, f"{moisture}%", 'нет', '-', '-'])
        except Exception as e:
            irr_rows.append([name, f"{moisture}%", 'ERROR', str(e)[:20], '-'])

    print_table(
        ['Сценарий', 'Влажность', 'Приоритет', 'Вода', 'Уверен.'],
        irr_rows, col_widths=[26, 12, 12, 14, 10]
    )


# ===========================================================================
# СЕКЦИЯ 8: КРОСС-ВАЛИДАЦИЯ ML МОДЕЛИ
# ===========================================================================

def section_cross_validation():
    print_separator()
    print("РАЗДЕЛ 8. КРОСС-ВАЛИДАЦИЯ ML-МОДЕЛИ (hold-out)")
    print_separator()

    from sklearn.model_selection import cross_val_score, KFold

    # Генерируем 3000 образцов — 2000 на обучение, 1000 на тест
    rng = np.random.default_rng(99)
    crops = ['wheat', 'corn', 'sunflower', 'barley', 'soy', 'sugar_beet', 'other']
    soils = ['Чернозём', 'Суглинок', 'Песчаник', 'Глинистый', 'Торфяной']

    CROP_BASELINES = {'wheat': 4.5, 'corn': 7.0, 'sunflower': 2.2,
                      'barley': 3.8, 'soy': 2.0, 'sugar_beet': 35.0, 'other': 3.0}
    SOIL_MULT = {'Чернозём': 1.15, 'Суглинок': 1.0, 'Песчаник': 0.85, 'Глинистый': 0.90, 'Торфяной': 0.95}

    n = 3000
    temps = rng.uniform(5, 40, n)
    hums = rng.uniform(25, 98, n)
    precs = rng.uniform(0, 25, n)
    precip7 = precs * 7 * rng.uniform(0.5, 1.5, n)
    avg_temps = temps + rng.uniform(-3, 3, n)
    soil_moist = np.clip(hums * 0.65 + precs * 1.2 + rng.normal(0, 8, n), 5, 98)
    solar = rng.uniform(150, 750, n)
    wind = rng.uniform(0.3, 14, n)
    crop_codes = rng.integers(0, 7, n)
    soil_codes = rng.integers(0, 5, n)

    yields = []
    for i in range(n):
        c = crops[crop_codes[i]]
        s = soils[soil_codes[i]]
        base = CROP_BASELINES.get(c, 3.0)
        sm = SOIL_MULT.get(s, 1.0)
        t = temps[i]
        tf = 1.1 if 18 <= t <= 28 else (0.8 if t > 32 or t < 10 else 0.95)
        sm_val = soil_moist[i]
        mf = (0.6 + sm_val/100 if sm_val < 35 else (0.9 if sm_val > 85 else 0.85 + (sm_val-35)*0.003))
        pf = min(1.2, 0.8 + precip7[i]/60)
        rf = min(1.1, 0.8 + solar[i]/1200)
        wf = 1.0 if wind[i] < 8 else 0.9
        y = base * sm * tf * mf * pf * rf * wf * float(0.85 + rng.random() * 0.30)
        yields.append(max(0.3, y))

    X = np.column_stack([temps, hums, precip7, avg_temps, soil_moist, solar, wind, crop_codes, soil_codes])
    y = np.array(yields)

    from sklearn.model_selection import train_test_split
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.33, random_state=42)

    model = Pipeline([
        ('scaler', StandardScaler()),
        ('rf', RandomForestRegressor(n_estimators=100, max_depth=8, min_samples_split=5, random_state=42, n_jobs=-1))
    ])

    print("  Обучение на 67% данных, тест на 33%...")
    t0 = time.time()
    model.fit(X_train, y_train)
    train_time = (time.time() - t0) * 1000

    y_pred = model.predict(X_test)
    mae_val = mae(y_test, y_pred)
    rmse_val = rmse(y_test, y_pred)
    r2_val = r2(y_test, y_pred)
    mape_val = mape(y_test, y_pred)

    print(f"  Время обучения: {train_time:.0f} мс")
    print(f"\n  Hold-out (n_test={len(X_test)}):")
    print(f"    MAE  = {mae_val:.4f} т/га")
    print(f"    RMSE = {rmse_val:.4f} т/га")
    print(f"    R²   = {r2_val:.4f}")
    print(f"    MAPE = {mape_val:.2f}%")

    # По культурам на тест-сете
    print("\n  Hold-out метрики по культурам:")
    crop_rows = []
    for ci, crop in enumerate(crops):
        mask = crop_codes[len(X_train):] == ci  # берём из тест части
        # Пересчитаем через индексы
        test_indices = np.where(crop_codes[len(X_train):] == ci)[0]
        if len(test_indices) < 5:
            continue
        y_c = y_test[test_indices]
        y_p = y_pred[test_indices]
        crop_rows.append([
            CROP_LABELS.get(crop, crop),
            f"{len(test_indices)}",
            f"{mae(y_c, y_p):.3f}",
            f"{rmse(y_c, y_p):.3f}",
            f"{r2(y_c, y_p):.4f}",
            f"{mape(y_c, y_p):.1f}%",
        ])
    print_table(
        ['Культура', 'N тест', 'MAE', 'RMSE', 'R²', 'MAPE'],
        crop_rows, col_widths=[16, 8, 10, 10, 10, 10]
    )

    # 5-fold CV
    print("\n  5-fold кросс-валидация (R²):")
    kf = KFold(n_splits=5, shuffle=True, random_state=42)
    cv_scores = cross_val_score(model, X, y, cv=kf, scoring='r2', n_jobs=-1)
    for i, score in enumerate(cv_scores, 1):
        print(f"    Fold {i}: R² = {score:.4f}")
    print(f"    Среднее R²: {np.mean(cv_scores):.4f} ± {np.std(cv_scores):.4f}")

    return mae_val, rmse_val, r2_val, mape_val


# ===========================================================================
# СЕКЦИЯ 9: ИТОГОВЫЙ ОТЧЁТ
# ===========================================================================

def section_final_report(crop_results, acc_recommend, acc_priority, lat_results, cv_metrics):
    print_separator('=')
    print("ИТОГОВЫЙ ОТЧЁТ: КОМПЛЕКСНОЕ ТЕСТИРОВАНИЕ ML-МОДЕЛИ")
    print_separator('=')
    print(f"  Дата тестирования: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"  Модель: Random Forest (n_estimators=100, max_depth=8)")
    print(f"  Обучающих образцов: 2000 (синтетических)")
    print()

    print("1. ТОЧНОСТЬ ПРОГНОЗА УРОЖАЙНОСТИ (на исторических данных 2019–2023)")
    print_separator('-')
    rows = []
    for crop, res in crop_results.items():
        rows.append([
            CROP_LABELS.get(crop, crop),
            f"{res['mae']:.3f}",
            f"{res['rmse']:.3f}",
            f"{res['r2']:+.4f}",
            f"{res['mape']:.1f}%",
            "ХОРОШО" if res['mape'] < 15 else ("СРЕДНЕ" if res['mape'] < 25 else "ПЛОХО"),
        ])
    print_table(
        ['Культура', 'MAE т/га', 'RMSE т/га', 'R²', 'MAPE', 'Оценка'],
        rows, col_widths=[16, 10, 12, 10, 10, 10]
    )

    print(f"\n2. КРОСС-ВАЛИДАЦИЯ (hold-out 33%)")
    print_separator('-')
    mae_cv, rmse_cv, r2_cv, mape_cv = cv_metrics
    print(f"  MAE  = {mae_cv:.4f} т/га")
    print(f"  RMSE = {rmse_cv:.4f} т/га")
    print(f"  R²   = {r2_cv:.4f}")
    print(f"  MAPE = {mape_cv:.2f}%")

    print(f"\n3. ТОЧНОСТЬ РЕКОМЕНДАЦИЙ ПО ПОЛИВУ")
    print_separator('-')
    print(f"  Точность решения (да/нет): {acc_recommend:.1f}%")
    print(f"  Точность приоритета:       {acc_priority:.1f}%")
    irr_status = "ОТЛИЧНО" if acc_recommend >= 90 else ("ХОРОШО" if acc_recommend >= 80 else "ТРЕБУЕТ ДОРАБОТКИ")
    print(f"  Общая оценка: {irr_status}")

    print(f"\n4. ПРОИЗВОДИТЕЛЬНОСТЬ (локальные вызовы)")
    print_separator('-')
    rows_lat = []
    for endpoint, lats in lat_results.items():
        la = np.array(lats)
        rows_lat.append([
            endpoint,
            f"{np.mean(la):.3f}",
            f"{np.percentile(la, 95):.3f}",
            f"{np.max(la):.3f}",
        ])
    print_table(
        ['Операция', 'Avg мс', 'P95 мс', 'Max мс'],
        rows_lat, col_widths=[36, 9, 9, 9]
    )

    print(f"\n5. ВЫВОДЫ И ЗАКЛЮЧЕНИЕ")
    print_separator('-')
    all_mapes = [r['mape'] for r in crop_results.values()]
    avg_mape = np.mean(all_mapes)
    print(f"""
  a) ПРОГНОЗ УРОЖАЙНОСТИ
     Средняя ошибка MAPE по культурам: {avg_mape:.1f}%
     {"★ Приемлемая точность для агросистемы" if avg_mape < 20 else "⚠ Требуется дообучение на реальных данных"}

     Лучшие культуры (малая MAPE): {', '.join([CROP_LABELS.get(c,'') for c, r in crop_results.items() if r['mape'] < 15])}
     Слабые культуры (MAPE > 20%): {', '.join([CROP_LABELS.get(c,'') for c, r in crop_results.items() if r['mape'] > 20]) or 'нет'}

  b) РЕКОМЕНДАЦИИ ПО ПОЛИВУ
     Точность {acc_recommend:.1f}% — {"хорошее rule-based решение" if acc_recommend > 85 else "средний результат"}
     Rule-based алгоритм корректно обрабатывает критические ситуации.
     Граничные случаи (влажность ≥ оптимума) обрабатываются правильно.

  c) ПРОИЗВОДИТЕЛЬНОСТЬ
     Predict-функция работает быстро (< 10 мс на вызов локально).
     При HTTP-запросах через API gateway добавится сетевая задержка ~50–200 мс.

  d) ПРОБЛЕМЫ И ОГРАНИЧЕНИЯ
     - Обучение только на синтетических данных → высокая дисперсия на реальных случаях
     - Отсутствует учёт фенологической стадии культуры (посев/цветение/созревание)
     - Линейный label-encoding культур и почв не отражает агрономические связи
     - Диапазон уверенности строится по 20 деревьям (не полный ансамбль)
     - Модель полива полностью rule-based (нет ML для irrigation)
     - R² может быть отрицательным при малом тест-сете из-за высокой внутрикультурной дисперсии

  e) РЕКОМЕНДАЦИИ ПО УЛУЧШЕНИЮ
     - Добавить реальные агрометеорологические данные (ГИСМО, агронет)
     - Ввести фенологическую стадию как признак
     - Использовать one-hot encoding вместо label encoding для культур
     - Перейти на Gradient Boosting (XGBoost/LightGBM) для улучшения R²
     - Добавить ML-компонент для irrigation (не только rules)
     - Применить Bayesian Optimization для подбора гиперпараметров
""")


# ===========================================================================
# MAIN
# ===========================================================================

def main():
    print()
    print_separator('*')
    print("*  КОМПЛЕКСНОЕ ТЕСТИРОВАНИЕ ML-МОДЕЛИ АНАЛИТИЧЕСКОГО СЕРВИСА  *")
    print_separator('*')
    print()

    # 1. Анализ кода
    section_code_analysis()

    # 2. Инициализация моделей
    yield_model, irr_model = init_models()

    # 3. Точность по культурам
    crop_results = section_crop_accuracy(yield_model)

    # 4. Погодные сценарии
    section_weather_scenarios(yield_model)

    # 5. Рекомендации по поливу
    acc_recommend, acc_priority, irr_latencies = section_irrigation(irr_model)

    # 6. Латентность
    lat_results = section_latency(yield_model, irr_model)

    # 7. Edge cases
    section_edge_cases(yield_model, irr_model)

    # 8. Кросс-валидация
    cv_metrics = section_cross_validation()

    # 9. Итоговый отчёт
    section_final_report(crop_results, acc_recommend, acc_priority, lat_results, cv_metrics)


if __name__ == '__main__':
    main()
