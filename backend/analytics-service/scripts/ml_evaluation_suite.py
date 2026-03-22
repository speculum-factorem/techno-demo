#!/usr/bin/env python3
"""
Комплексная офлайн-оценка ML урожайности и правил полива (как в main.py).

Запуск из каталога analytics-service:
  python scripts/ml_evaluation_suite.py --all
  python scripts/ml_evaluation_suite.py --accuracy --scenarios --irrigation --latency
  python scripts/ml_evaluation_suite.py --api-latency --base-url http://localhost:8080/api/analytics

Для --api-latency нужен поднятый gateway + analytics; прогноз может требовать JWT —
тогда задайте --bearer TOKEN (иначе часть запросов вернёт 401).
"""
from __future__ import annotations

import argparse
import json
import statistics
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

# ─── Тот же синтетический генератор, что YieldPredictionModel._generate_training_data ───

CROP_YIELD_BASELINES = {
    "wheat": 4.5, "corn": 7.0, "sunflower": 2.2, "barley": 3.8,
    "soy": 2.0, "sugar_beet": 35.0, "other": 3.0,
}
SOIL_MULTIPLIERS = {
    "Чернозём": 1.15, "Суглинок": 1.0, "Песчаник": 0.85, "Глинистый": 0.90, "Торфяной": 0.95,
}
FEATURES = [
    "temperature", "humidity", "precipitation_7d", "avg_temperature_7d",
    "soil_moisture", "solar_radiation", "wind_speed", "crop_code", "soil_code",
]
CROPS = ["wheat", "corn", "sunflower", "barley", "soy", "sugar_beet", "other"]
SOILS = ["Чернозём", "Суглинок", "Песчаник", "Глинистый", "Торфяной"]


def generate_training_data(n_samples: int = 5000) -> pd.DataFrame:
    np.random.seed(42)
    rng = np.random.default_rng(42)
    rows = []
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
        crop = CROPS[crop_code]
        soil = SOILS[soil_code]
        base = CROP_YIELD_BASELINES.get(crop, 3.0)
        soil_mult = SOIL_MULTIPLIERS.get(soil, 1.0)
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
        rows.append({
            "temperature": round(temp, 2),
            "humidity": round(humidity_air, 2),
            "precipitation_7d": round(precip_7d, 2),
            "avg_temperature_7d": round(avg_temp, 2),
            "soil_moisture": round(soil_moisture, 2),
            "solar_radiation": round(solar_rad, 2),
            "wind_speed": round(wind_speed, 2),
            "crop_code": crop_code,
            "soil_code": soil_code,
            "yield": round(yield_abs, 3),
        })
    return pd.DataFrame(rows)


def build_fitted_pipeline(df: pd.DataFrame) -> Pipeline:
    X = df[FEATURES].values
    y = df["yield"].values
    model = Pipeline([
        ("scaler", StandardScaler()),
        ("regressor", RandomForestRegressor(
            n_estimators=100, max_depth=8, min_samples_split=5, random_state=42, n_jobs=-1,
        )),
    ])
    model.fit(X, y)
    return model


def vector_from_weather(
    temp: float, hum: float, p7: float, avg_t: float, sm: float, sol: float, wind: float,
    crop_code: int, soil_code: int,
) -> np.ndarray:
    return np.array([[temp, hum, p7, avg_t, sm, sol, wind, crop_code, soil_code]])


# ─── Копия логики IrrigationModel.recommend (для регрессионных тестов без import main) ───

CROP_OPTIMAL_MOISTURE = {
    "wheat": (55, 75), "corn": (65, 80), "sunflower": (60, 75), "barley": (50, 70),
    "soy": (65, 80), "sugar_beet": (70, 85), "other": (60, 75),
}


def irrigation_recommend(
    field_id: str,
    field_name: str,
    crop_type: str,
    current_moisture: float,
    forecast_precipitation_7d: float,
    area: float,
    temperature: float,
) -> List[dict]:
    recommendations = []
    optimal_min, _ = CROP_OPTIMAL_MOISTURE.get(crop_type, (60, 75))
    moisture_deficit = max(0, optimal_min - current_moisture)

    if moisture_deficit > 25 or (moisture_deficit > 0 and current_moisture < 35):
        priority = "critical"
    elif moisture_deficit > 15:
        priority = "high"
    elif moisture_deficit > 8:
        priority = "medium"
    elif moisture_deficit > 0:
        priority = "low"
    else:
        return []

    water_needed = max(10, min(60, moisture_deficit * 2.5))
    duration_minutes = int(water_needed / 5.0 * 60)
    recommendations.append({
        "priority": priority,
        "waterAmount": round(water_needed, 1),
        "duration": duration_minutes,
        "moistureDeficit": round(moisture_deficit, 1),
    })
    if priority in ("critical", "high") and forecast_precipitation_7d < 10:
        follow_water = max(15, water_needed * 0.6)
        recommendations.append({
            "priority": "medium",
            "waterAmount": round(follow_water, 1),
            "duration": int(follow_water / 5.0 * 60),
        })
    return recommendations


def run_accuracy(n_samples: int) -> bool:
    print("\n=== 1. Точность на синтетике (честный hold-out 20%) ===")
    df = generate_training_data(n_samples)
    X = df[FEATURES].values
    y = df["yield"].values
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    model = Pipeline([
        ("scaler", StandardScaler()),
        ("regressor", RandomForestRegressor(
            n_estimators=100, max_depth=8, min_samples_split=5, random_state=42, n_jobs=-1,
        )),
    ])
    model.fit(X_train, y_train)
    y_pred = model.predict(X_test)
    mae = mean_absolute_error(y_test, y_pred)
    rmse = float(np.sqrt(mean_squared_error(y_test, y_pred)))
    r2 = r2_score(y_test, y_pred)
    acc15 = float(np.mean(np.abs((y_pred - y_test) / np.maximum(y_test, 0.1)) < 0.15) * 100)
    print(f"  MAE:   {mae:.4f} т/га")
    print(f"  RMSE:  {rmse:.4f} т/га")
    print(f"  R²:    {r2:.4f}")
    print(f"  ±15%:  {acc15:.2f}%")
    ok = r2 >= 0.85 and mae < 2.5
    print(f"  Критерий приёмки (демо): R²≥0.85 и MAE<2.5 т/га → {'PASS' if ok else 'FAIL'}")
    return ok


def run_scenarios() -> bool:
    print("\n=== 2. Сценарии погоды (монотонность урожайности, пшеница / чернозём) ===")
    df = generate_training_data(4000)
    model = build_fitted_pipeline(df)
    crop_code = CROPS.index("wheat")
    soil_code = SOILS.index("Чернозём")

    def predict_yield(**kw) -> float:
        defaults = dict(
            temperature=22.0, humidity=65.0, precipitation_7d=18.0, avg_temperature_7d=22.0,
            soil_moisture=62.0, solar_radiation=550.0, wind_speed=3.0,
        )
        defaults.update(kw)
        v = vector_from_weather(
            defaults["temperature"], defaults["humidity"], defaults["precipitation_7d"],
            defaults["avg_temperature_7d"], defaults["soil_moisture"], defaults["solar_radiation"],
            defaults["wind_speed"], crop_code, soil_code,
        )
        return float(model.predict(v)[0])

    y_opt = predict_yield()
    y_drought = predict_yield(soil_moisture=22.0, precipitation_7d=2.0, temperature=35.0, avg_temperature_7d=34.0)
    y_stress_hot = predict_yield(temperature=38.0, avg_temperature_7d=37.0, soil_moisture=45.0, precipitation_7d=5.0)
    y_wet = predict_yield(soil_moisture=78.0, precipitation_7d=45.0, humidity=80.0)

    print(f"  Оптимальные условия:     {y_opt:.3f} т/га")
    print(f"  Засуха (низкая влага):   {y_drought:.3f} т/га")
    print(f"  Жара + стресс:         {y_stress_hot:.3f} т/га")
    print(f"  Высокая влага/осадки:  {y_wet:.3f} т/га")

    ok = y_drought < y_opt and y_stress_hot < y_opt
    print(f"  Ожидание: засуха и жара дают урожай ниже «оптимума» → {'PASS' if ok else 'FAIL'}")
    return ok


def run_irrigation() -> bool:
    print("\n=== 3. Релевантность рекомендаций полива (правила) ===")
    cases: List[Tuple[str, float, str, bool]] = [
        ("wheat", 28.0, "critical", True),
        ("wheat", 40.0, "medium", True),
        ("wheat", 62.0, "", False),
        ("corn", 45.0, "high", True),
        ("wheat", 52.0, "low", True),
    ]
    ok_all = True
    for crop, moisture, exp_priority, expect_any in cases:
        recs = irrigation_recommend(
            "f1", "Поле 1", crop, moisture, 5.0, 50.0, 22.0,
        )
        if not expect_any:
            passed = len(recs) == 0
            print(f"  {crop} влага={moisture}% → без рекомендаций: {'PASS' if passed else 'FAIL'}")
        else:
            top = recs[0]["priority"] if recs else None
            passed = top == exp_priority
            print(f"  {crop} влага={moisture}% → ожид. {exp_priority}, факт {top}: {'PASS' if passed else 'FAIL'}")
        ok_all = ok_all and passed
    deficit_order = [irrigation_recommend("f1", "П", "wheat", m, 2.0, 50.0, 22.0)[0]["waterAmount"] for m in (30, 40, 50)]
    monotonic = deficit_order[0] >= deficit_order[1] >= deficit_order[2]
    print(f"  Объём воды при влаге 30/40/50% не растёт при росте влаги: {'PASS' if monotonic else 'FAIL'}")
    return ok_all and monotonic


def run_latency_local(n_iter: int = 800) -> bool:
    print("\n=== 4. Скорость локального predict (RandomForest после fit) ===")
    df = generate_training_data(3000)
    model = build_fitted_pipeline(df)
    row = df.iloc[0][FEATURES].values.reshape(1, -1)
    # прогрев
    for _ in range(20):
        model.predict(row)
    times = []
    for _ in range(n_iter):
        t0 = time.perf_counter()
        model.predict(row)
        times.append(time.perf_counter() - t0)
    times.sort()
    p50 = statistics.median(times) * 1000
    idx95 = min(len(times) - 1, int(0.95 * (len(times) - 1)))
    p95 = times[idx95] * 1000
    print(f"  Итераций: {n_iter}, p50: {p50:.3f} ms, ~p95: {p95:.3f} ms")
    ok = p95 < 50.0
    print(f"  Критерий демо: p95 < 50 ms на один прогноз → {'PASS' if ok else 'FAIL'}")
    return ok


def run_api_latency(base_url: str, bearer: Optional[str], n: int) -> bool:
    print(f"\n=== 5. Задержка HTTP: {base_url} ===")
    base = base_url.rstrip("/")

    def req(method: str, path: str, body: Optional[dict] = None) -> Tuple[int, float]:
        url = f"{base}{path}"
        data = json.dumps(body).encode() if body else None
        h = {"Content-Type": "application/json"}
        if bearer:
            h["Authorization"] = f"Bearer {bearer}"
        t0 = time.perf_counter()
        r = urllib.request.Request(url, data=data, headers=h, method=method)
        try:
            with urllib.request.urlopen(r, timeout=60) as resp:
                resp.read()
                code = resp.status
            dt = time.perf_counter() - t0
            return code, dt
        except urllib.error.HTTPError as e:
            dt = time.perf_counter() - t0
            return e.code, dt
        except Exception as e:
            print(f"  Ошибка запроса: {e}")
            return -1, 0.0

    code, dt = req("GET", "/health")
    print(f"  GET /health → {code}, {dt*1000:.1f} ms")
    if code != 200:
        print("  SKIP прогноза: health не 200")
        return False

    body = {
        "fieldId": "eval-field",
        "targetDate": datetime.now().strftime("%Y-%m-%d"),
        "cropType": "wheat",
        "area": 50.0,
        "soilType": "Чернозём",
        "includeFactors": True,
    }
    times = []
    last_code = 0
    for _ in range(n):
        code, dt = req("POST", "/forecast/yield", body)
        last_code = code
        if code == 200:
            times.append(dt)
    if not times:
        print(f"  POST /forecast/yield не удался (код {last_code}). Нужен JWT? --bearer <token>")
        return False
    times.sort()
    p50 = statistics.median(times) * 1000
    idx95 = min(len(times) - 1, int(0.95 * (len(times) - 1)))
    p95 = times[idx95] * 1000
    print(f"  POST /forecast/yield ×{len(times)}: p50 {p50:.1f} ms, ~p95 {p95:.1f} ms")
    return True


def main() -> int:
    p = argparse.ArgumentParser(description="ML evaluation suite for AgroAnalytics")
    p.add_argument("--all", action="store_true", help="все офлайн-проверки")
    p.add_argument("--accuracy", action="store_true")
    p.add_argument("--scenarios", action="store_true")
    p.add_argument("--irrigation", action="store_true")
    p.add_argument("--latency", action="store_true")
    p.add_argument("--api-latency", action="store_true")
    p.add_argument("--base-url", default="http://127.0.0.1:8080/api/analytics", help="для --api-latency")
    p.add_argument("--bearer", default=None, help="JWT для прогноза через gateway")
    p.add_argument("--samples", type=int, default=5000, help="размер датасета для --accuracy")
    p.add_argument("--api-n", type=int, default=30, help="число POST прогноза для latency")
    args = p.parse_args()

    if not any([args.all, args.accuracy, args.scenarios, args.irrigation, args.latency, args.api_latency]):
        args.all = True

    results = []
    if args.all or args.accuracy:
        results.append(run_accuracy(args.samples))
    if args.all or args.scenarios:
        results.append(run_scenarios())
    if args.all or args.irrigation:
        results.append(run_irrigation())
    if args.all or args.latency:
        results.append(run_latency_local())
    if args.api_latency:
        results.append(run_api_latency(args.base_url, args.bearer, args.api_n))

    failed = sum(1 for r in results if not r)
    print(f"\nИтого проверок: {len(results)}, провалов: {failed}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
