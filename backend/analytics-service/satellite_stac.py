"""
Sentinel-2 L2A indices (NDVI, NDMI) via Microsoft Planetary Computer STAC + COG reads.
No API keys required. Requires outbound HTTPS from the analytics container.
"""
from __future__ import annotations

import logging
import math
from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import planetary_computer
import pystac_client
import rasterio
from rasterio.enums import Resampling
from rasterio.warp import transform_bounds

logger = logging.getLogger(__name__)

STAC_URL = "https://planetarycomputer.microsoft.com/api/stac/v1"
COLLECTION = "sentinel-2-l2a"
# SCL: cloud / cirrus / snow / saturated — mask out
SCL_MASK_VALUES = {0, 1, 2, 3, 8, 9, 10, 11}


def _catalog() -> pystac_client.Client:
    return pystac_client.Client.open(STAC_URL, modifier=planetary_computer.sign_inplace)


def bbox_from_field(lat: float, lng: float, area_ha: float) -> Tuple[float, float, float, float]:
    """min_lon, min_lat, max_lon, max_lat in WGS84."""
    radius_m = math.sqrt(max(float(area_ha), 0.5) * 10000.0 / math.pi)
    delta_deg = min(0.12, max(0.002, radius_m / 111_320.0))
    return (lng - delta_deg, lat - delta_deg, lng + delta_deg, lat + delta_deg)


def _item_datetime(it: Any) -> Optional[datetime]:
    dt = getattr(it, "datetime", None)
    if dt is not None:
        return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
    props = getattr(it, "properties", {}) or {}
    raw = props.get("datetime")
    if not raw:
        return None
    try:
        d = datetime.fromisoformat(raw.replace("Z", "+00:00"))
        return d if d.tzinfo else d.replace(tzinfo=timezone.utc)
    except ValueError:
        return None


def _item_cloud_cover(it: Any) -> float:
    props = getattr(it, "properties", {}) or {}
    for key in ("eo:cloud_cover", "cloud_cover"):
        v = props.get(key)
        if v is not None:
            try:
                return float(v)
            except (TypeError, ValueError):
                pass
    return 999.0


def _asset_href(item: Any, *keys: str) -> Optional[str]:
    assets = getattr(item, "assets", {}) or {}
    for k in keys:
        a = assets.get(k)
        if a is not None and getattr(a, "href", None):
            return a.href
    return None


def _read_band(
    href: str,
    bbox_ll: Tuple[float, float, float, float],
    height: int,
    width: int,
) -> np.ndarray:
    """Read single band, scale to approximate reflectance 0..1, NaN for nodata."""
    with rasterio.open(href) as src:
        dst_crs = src.crs
        if dst_crs is None:
            raise ValueError("Raster has no CRS")
        left, bottom, right, top = transform_bounds(
            "EPSG:4326",
            dst_crs,
            bbox_ll[0],
            bbox_ll[1],
            bbox_ll[2],
            bbox_ll[3],
            densify_pts=21,
        )
        data = src.read(
            1,
            out_shape=(height, width),
            window=rasterio.windows.from_bounds(left, bottom, right, top, src.transform),
            resampling=Resampling.bilinear,
        ).astype(np.float32)
    out = np.where(data > 0, data / 10000.0, np.nan)
    return np.clip(out, 0.0, 1.0)


def _compute_indices(
    item: Any,
    bbox_ll: Tuple[float, float, float, float],
    height: int,
    width: int,
) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    b04 = _asset_href(item, "B04", "b04")
    b08 = _asset_href(item, "B08", "b08")
    b11 = _asset_href(item, "B11", "b11")
    scl = _asset_href(item, "SCL", "scl")
    if not all([b04, b08, b11, scl]):
        raise ValueError("Sentinel-2 item missing required assets (B04/B08/B11/SCL)")

    red = _read_band(b04, bbox_ll, height, width)
    nir = _read_band(b08, bbox_ll, height, width)
    swir = _read_band(b11, bbox_ll, height, width)

    with rasterio.open(scl) as src:
        dst_crs = src.crs
        left, bottom, right, top = transform_bounds(
            "EPSG:4326",
            dst_crs,
            bbox_ll[0],
            bbox_ll[1],
            bbox_ll[2],
            bbox_ll[3],
            densify_pts=21,
        )
        scl_data = src.read(
            1,
            out_shape=(height, width),
            window=rasterio.windows.from_bounds(left, bottom, right, top, src.transform),
            resampling=Resampling.nearest,
        ).astype(np.int16)

    bad = np.isin(scl_data, list(SCL_MASK_VALUES))
    invalid = bad | ~np.isfinite(red) | ~np.isfinite(nir) | (red + nir) <= 1e-6
    invalid_swir = bad | ~np.isfinite(nir) | ~np.isfinite(swir) | (nir + swir) <= 1e-6

    ndvi = (nir - red) / (nir + red + 1e-6)
    ndmi = (nir - swir) / (nir + swir + 1e-6)

    ndvi = np.where(invalid, np.nan, ndvi)
    ndmi = np.where(invalid_swir, np.nan, ndmi)
    return ndvi, ndmi, (~bad).astype(np.float32)


def _downsample_grid(arr: np.ndarray, grid_h: int, grid_w: int) -> np.ndarray:
    h, w = arr.shape
    y_edges = np.linspace(0, h, grid_h + 1, dtype=int)
    x_edges = np.linspace(0, w, grid_w + 1, dtype=int)
    out = np.full((grid_h, grid_w), np.nan, dtype=np.float64)
    for i in range(grid_h):
        for j in range(grid_w):
            sl = arr[y_edges[i] : y_edges[i + 1], x_edges[j] : x_edges[j + 1]]
            if np.any(np.isfinite(sl)):
                out[i, j] = float(np.nanmean(sl))
    return out


def _stats_from_ndvi_ndmi(ndvi: np.ndarray, ndmi: np.ndarray, valid_mask: np.ndarray) -> Dict[str, Any]:
    flat_v = valid_mask.reshape(-1)
    n = int(np.sum(flat_v > 0))
    total = flat_v.size
    coverage_pct = round(100.0 * n / max(total, 1), 1)

    ndvi_f = ndvi[np.isfinite(ndvi)]
    ndmi_f = ndmi[np.isfinite(ndmi)]

    stress_pct = 0.0
    if ndvi_f.size:
        stress_pct = round(100.0 * float(np.mean(ndvi_f < 0.35)), 1)

    def _nm(a: np.ndarray) -> Optional[float]:
        if not a.size:
            return None
        m = float(np.nanmean(a))
        return m if np.isfinite(m) else None

    def _bound(a: np.ndarray, fn) -> Optional[float]:
        if not a.size:
            return None
        v = float(fn(a))
        return v if np.isfinite(v) else None

    mn_ndvi = _nm(ndvi_f)
    mn_ndmi = _nm(ndmi_f)
    min_ndvi = _bound(ndvi_f, np.nanmin)
    max_ndvi = _bound(ndvi_f, np.nanmax)
    return {
        "meanNdvi": round(mn_ndvi, 4) if mn_ndvi is not None else None,
        "meanNdmi": round(mn_ndmi, 4) if mn_ndmi is not None else None,
        "minNdvi": round(min_ndvi, 4) if min_ndvi is not None else None,
        "maxNdvi": round(max_ndvi, 4) if max_ndvi is not None else None,
        "coverageGoodPercent": coverage_pct,
        "stressLowVegetationPercent": stress_pct,
    }


def search_items(
    bbox_ll: Tuple[float, float, float, float],
    start: date,
    end: date,
    max_items: int = 80,
) -> List[Any]:
    catalog = _catalog()
    search = catalog.search(
        collections=[COLLECTION],
        bbox=list(bbox_ll),
        datetime=f"{start.isoformat()}T00:00:00Z/{end.isoformat()}T23:59:59Z",
        query={"eo:cloud_cover": {"lt": 85}},
        max_items=max_items,
    )
    items = list(search.items())

    def _sort_key(it: Any):
        dt = _item_datetime(it)
        return dt or datetime(1970, 1, 1, tzinfo=timezone.utc)

    items.sort(key=_sort_key, reverse=True)
    return items


def list_available_dates(
    lat: float,
    lng: float,
    area_ha: float,
    days: int = 120,
) -> List[str]:
    bbox_ll = bbox_from_field(lat, lng, area_ha)
    end = date.today()
    start = end - timedelta(days=max(7, days))
    items = search_items(bbox_ll, start, end, max_items=100)
    seen = set()
    out: List[str] = []
    for it in items:
        dt = _item_datetime(it)
        if not dt:
            continue
        d = dt.date().isoformat()
        if d not in seen:
            seen.add(d)
            out.append(d)
    out.sort(reverse=True)
    return out[:40]


def pick_item_for_date(items: List[Any], target: date) -> Optional[Any]:
    best: Optional[Any] = None
    best_cloud = 999.0
    for it in items:
        dt = _item_datetime(it)
        if not dt:
            continue
        if dt.date() != target:
            continue
        cc = _item_cloud_cover(it)
        if cc < best_cloud:
            best_cloud = cc
            best = it
    if best is not None:
        return best
    # nearest scene within ±5 days
    best = None
    best_score = 1e9
    for it in items:
        dt = _item_datetime(it)
        if not dt:
            continue
        diff = abs((dt.date() - target).days)
        if diff > 5:
            continue
        score = diff * 1000 + _item_cloud_cover(it)
        if score < best_score:
            best_score = score
            best = it
    return best


def build_grid_for_field(
    lat: float,
    lng: float,
    area_ha: float,
    target_date: str,
    index: str,
    grid_w: int = 12,
    grid_h: int = 8,
    read_size: int = 120,
) -> Dict[str, Any]:
    bbox_ll = bbox_from_field(lat, lng, area_ha)
    td = date.fromisoformat(target_date)
    start = td - timedelta(days=14)
    end = td + timedelta(days=14)
    items = search_items(bbox_ll, start, end, max_items=40)
    item = pick_item_for_date(items, td)
    if item is None:
        raise LookupError(f"No Sentinel-2 scene for ~{target_date} (try another date)")

    ndvi, ndmi, valid = _compute_indices(item, bbox_ll, read_size, read_size)
    cells_full = ndvi if index.lower() == "ndvi" else ndmi
    grid = _downsample_grid(cells_full, grid_h, grid_w)
    stats = _stats_from_ndvi_ndmi(ndvi, ndmi, valid)

    dt = _item_datetime(item)
    props = getattr(item, "properties", {}) or {}

    return {
        "source": "Sentinel-2 L2A (Microsoft Planetary Computer)",
        "itemId": getattr(item, "id", None),
        "sceneDatetime": dt.isoformat() if dt else props.get("datetime"),
        "cloudCover": round(_item_cloud_cover(item), 2) if _item_cloud_cover(item) < 900 else None,
        "cells": [[None if not np.isfinite(v) else round(float(v), 4) for v in row] for row in grid],
        "stats": stats,
    }


def build_series(
    lat: float,
    lng: float,
    area_ha: float,
    days: int = 120,
    max_points: int = 8,
) -> List[Dict[str, Any]]:
    bbox_ll = bbox_from_field(lat, lng, area_ha)
    end = date.today()
    start = end - timedelta(days=max(14, days))
    items = search_items(bbox_ll, start, end, max_items=60)

    points: List[Dict[str, Any]] = []
    seen_dates = set()
    for it in items:
        if len(points) >= max_points:
            break
        dt = _item_datetime(it)
        if not dt:
            continue
        d = dt.date().isoformat()
        if d in seen_dates:
            continue
        try:
            ndvi, ndmi, valid = _compute_indices(it, bbox_ll, 48, 48)
            st = _stats_from_ndvi_ndmi(ndvi, ndmi, valid)
            if st.get("meanNdvi") is None:
                continue
            seen_dates.add(d)
            points.append(
                {
                    "date": d,
                    "ndvi": st["meanNdvi"],
                    "ndmi": st["meanNdmi"],
                    "cloudCover": round(_item_cloud_cover(it), 1) if _item_cloud_cover(it) < 900 else None,
                }
            )
        except Exception as exc:
            logger.debug("Skip item %s: %s", getattr(it, "id", "?"), exc)
            continue

    points.sort(key=lambda x: x["date"], reverse=True)
    return points
