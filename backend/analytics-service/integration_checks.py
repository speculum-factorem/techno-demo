"""
Реальные проверки при подключении интеграций (без фиктивного +42).
metrics передаётся из main: field_count, fields_with_geo_count, telemetry_count.
"""
from __future__ import annotations

import logging
import os
import socket
import smtplib
from typing import Any, Dict, Tuple

import requests

logger = logging.getLogger(__name__)

OPEN_METEO_BASE_URL = os.getenv("OPEN_METEO_BASE_URL", "https://api.open-meteo.com")
MAIL_HOST = os.getenv("MAIL_HOST", "").strip()
MAIL_PORT = int(os.getenv("MAIL_PORT", "587") or "587")
MAIL_USERNAME = os.getenv("MAIL_USERNAME", "").strip()
MAIL_PASSWORD = os.getenv("MAIL_PASSWORD", "").strip()
MAIL_FROM = os.getenv("MAIL_FROM", "").strip() or MAIL_USERNAME
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "").strip()


def verify_integration_connect(
    integration_type: str,
    config: Dict[str, Any],
    metrics: Dict[str, int],
) -> Tuple[int, str]:
    """
    Возвращает (records_synced, сообщение для аудита).
    Бросает IntegrationCheckError с текстом для HTTP detail.
    """
    fc = int(metrics.get("field_count") or 0)
    fgeo = int(metrics.get("fields_with_geo_count") or 0)
    tc = int(metrics.get("telemetry_count") or 0)

    it = (integration_type or "").strip()

    if it == "weather_api":
        return _check_open_meteo(fc)

    if it == "iot_gateway":
        return _check_iot_gateway(tc, fc)

    if it == "email_smtp":
        return _check_smtp(config)

    if it == "telegram":
        return _check_telegram()

    if it == "1c_erp":
        return _check_tcp_service(config, "1С / ERP")

    if it == "geo_import":
        if fgeo < 1:
            raise IntegrationCheckError(
                "Нет полей с координатами lat/lng в field-service — импорт GIS не к чему привязать"
            )
        return fgeo, f"Полей с геометрией: {fgeo}"

    raise IntegrationCheckError(f"Неизвестный тип интеграции: {it}")


class IntegrationCheckError(Exception):
    pass


def _check_open_meteo(field_count: int) -> Tuple[int, str]:
    try:
        r = requests.get(
            f"{OPEN_METEO_BASE_URL.rstrip('/')}/v1/forecast",
            params={"latitude": 47.2, "longitude": 39.7, "current": "temperature_2m"},
            timeout=12,
        )
        r.raise_for_status()
    except Exception as e:
        raise IntegrationCheckError(f"Open-Meteo недоступен: {e!s}") from e
    n = max(field_count, 1)
    return n, f"Погодный API отвечает; учтено полей в системе: {field_count}"


def _check_iot_gateway(telemetry_count: int, field_count: int) -> Tuple[int, str]:
    if telemetry_count < 1:
        raise IntegrationCheckError(
            "В БД нет записей IoT-телеметрии. Отправьте данные на POST /api/analytics/iot/telemetry "
            "(или подключите коннектор), затем повторите подключение."
        )
    msg = f"Записей телеметрии в БД: {telemetry_count}, полей: {field_count}"
    return telemetry_count, msg


def _check_smtp(row_config: Dict[str, Any]) -> Tuple[int, str]:
    host = (MAIL_HOST or (row_config.get("host") or "")).strip()
    port_raw = row_config.get("port") if row_config.get("port") not in (None, "") else str(MAIL_PORT)
    try:
        port = int(str(port_raw).strip())
    except ValueError:
        port = 587
    user = (MAIL_USERNAME or (row_config.get("username") or "")).strip()
    password = (MAIL_PASSWORD or (row_config.get("password") or "")).strip()
    if not host:
        raise IntegrationCheckError("Задайте MAIL_HOST в окружении сервиса или host в конфиге интеграции")
    if not user:
        raise IntegrationCheckError("Задайте MAIL_USERNAME для SMTP-аутентификации")

    try:
        with smtplib.SMTP(host, port, timeout=30) as smtp:
            smtp.ehlo()
            try:
                smtp.starttls()
                smtp.ehlo()
            except smtplib.SMTPException:
                pass
            smtp.login(user, password)
    except Exception as e:
        raise IntegrationCheckError(f"SMTP не прошёл проверку ({host}:{port}): {e!s}") from e

    return 1, f"SMTP {host}:{port} — сессия и вход успешны"


def _check_telegram() -> Tuple[int, str]:
    if not TELEGRAM_BOT_TOKEN:
        raise IntegrationCheckError("Задайте TELEGRAM_BOT_TOKEN в окружении analytics-service")
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/getMe"
    try:
        r = requests.get(url, timeout=15)
        data = r.json()
        if not r.ok or not data.get("ok"):
            raise IntegrationCheckError(f"Telegram getMe: {data}")
        uname = (data.get("result") or {}).get("username", "?")
    except IntegrationCheckError:
        raise
    except Exception as e:
        raise IntegrationCheckError(f"Telegram API недоступен: {e!s}") from e
    return 1, f"Бот @{uname} подтверждён (getMe)"


def _check_tcp_service(config: Dict[str, Any], label: str) -> Tuple[int, str]:
    host = (config.get("host") or "").strip()
    if not host:
        raise IntegrationCheckError(
            f"Укажите host в конфиге интеграции ({label}) — адрес вашего сервера 1С/HTTP-сервиса"
        )
    port = int(config.get("port") or 80)
    try:
        with socket.create_connection((host, port), timeout=8):
            pass
    except OSError as e:
        raise IntegrationCheckError(
            f"{label}: нет TCP-соединения с {host}:{port} — {e!s}. Проверьте сеть, firewall и адрес."
        ) from e
    return 1, f"{label}: TCP {host}:{port} доступен"
