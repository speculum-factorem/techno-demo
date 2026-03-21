package com.agroanalytics.weather.service;

import com.agroanalytics.weather.dto.WeatherDataDto;
import com.agroanalytics.weather.dto.WeatherForecastDto;
import com.agroanalytics.weather.model.WeatherReading;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.*;

@Service
@Slf4j
public class OpenMeteoService {

    private final WebClient webClient;
    private final WebClient archiveWebClient;

    public OpenMeteoService(
            @Value("${open-meteo.base-url}") String baseUrl,
            @Value("${open-meteo.archive-base-url}") String archiveBaseUrl) {
        this.webClient = WebClient.builder()
                .baseUrl(baseUrl)
                .build();
        this.archiveWebClient = WebClient.builder()
                .baseUrl(archiveBaseUrl)
                .build();
    }

    @SuppressWarnings("unchecked")
    public WeatherReading fetchCurrentWeather(UUID fieldId, double latitude, double longitude) {
        try {
            Map<String, Object> response = webClient.get()
                    .uri(uriBuilder -> uriBuilder
                            .path("/v1/forecast")
                            .queryParam("latitude", latitude)
                            .queryParam("longitude", longitude)
                            .queryParam("hourly", "temperature_2m,relativehumidity_2m,precipitation,windspeed_10m,surface_pressure,shortwave_radiation,soil_moisture_0_to_1cm")
                            .queryParam("forecast_days", 1)
                            .queryParam("current_weather", true)
                            .build())
                    .retrieve()
                    .bodyToMono(Map.class)
                    .block();

            if (response == null) {
                log.warn("No response from Open-Meteo for field {}", fieldId);
                return null;
            }

            Map<String, Object> currentWeather = (Map<String, Object>) response.get("current_weather");
            Map<String, Object> hourly = (Map<String, Object>) response.get("hourly");

            if (currentWeather == null || hourly == null) {
                log.warn("Incomplete response from Open-Meteo for field {}", fieldId);
                return null;
            }

            List<String> times = (List<String>) hourly.get("time");
            List<Number> temperatures = (List<Number>) hourly.get("temperature_2m");
            List<Number> humidities = (List<Number>) hourly.get("relativehumidity_2m");
            List<Number> precipitations = (List<Number>) hourly.get("precipitation");
            List<Number> windSpeeds = (List<Number>) hourly.get("windspeed_10m");
            List<Number> pressures = (List<Number>) hourly.get("surface_pressure");
            List<Number> solarRadiations = (List<Number>) hourly.get("shortwave_radiation");
            List<Number> soilMoistures = (List<Number>) hourly.get("soil_moisture_0_to_1cm");

            // Use the most recent hourly data point
            int lastIndex = Math.max(0, (times != null ? times.size() : 1) - 1);

            double temperature = getDoubleValue(temperatures, lastIndex, currentWeather.get("temperature"));
            double humidity = getDoubleValue(humidities, lastIndex, 0.0);
            double precipitation = getDoubleValue(precipitations, lastIndex, 0.0);
            double windSpeed = getDoubleValue(windSpeeds, lastIndex, currentWeather.get("windspeed"));
            double windDirection = getDoubleValue(currentWeather, "winddirection", 0.0);
            double pressure = getDoubleValue(pressures, lastIndex, 1013.25);
            double solarRadiation = getDoubleValue(solarRadiations, lastIndex, 0.0);
            Double soilMoisture = soilMoistures != null && lastIndex < soilMoistures.size() && soilMoistures.get(lastIndex) != null
                    ? soilMoistures.get(lastIndex).doubleValue() * 100.0  // convert fraction to %
                    : null;

            return WeatherReading.builder()
                    .fieldId(fieldId)
                    .timestamp(Instant.now())
                    .temperature(temperature)
                    .humidity(humidity)
                    .precipitation(precipitation)
                    .windSpeed(windSpeed)
                    .windDirection(windDirection)
                    .pressure(pressure)
                    .solarRadiation(solarRadiation)
                    .soilMoisture(soilMoisture)
                    .soilTemperature(null)
                    .source("open-meteo")
                    .build();

        } catch (Exception e) {
            log.error("Error fetching weather from Open-Meteo for field {}: {}", fieldId, e.getMessage());
            return null;
        }
    }

    @SuppressWarnings("unchecked")
    public WeatherForecastDto fetchForecast(UUID fieldId, double latitude, double longitude) {
        try {
            Map<String, Object> response = webClient.get()
                    .uri(uriBuilder -> uriBuilder
                            .path("/v1/forecast")
                            .queryParam("latitude", latitude)
                            .queryParam("longitude", longitude)
                            .queryParam("hourly", "temperature_2m,relativehumidity_2m,precipitation,windspeed_10m,surface_pressure,shortwave_radiation,soil_moisture_0_to_1cm")
                            .queryParam("forecast_days", 7)
                            .queryParam("current_weather", true)
                            .build())
                    .retrieve()
                    .bodyToMono(Map.class)
                    .block();

            if (response == null) {
                return WeatherForecastDto.builder()
                        .fieldId(fieldId)
                        .hourly(Collections.emptyList())
                        .build();
            }

            Map<String, Object> hourly = (Map<String, Object>) response.get("hourly");
            if (hourly == null) {
                return WeatherForecastDto.builder()
                        .fieldId(fieldId)
                        .hourly(Collections.emptyList())
                        .build();
            }

            List<String> times = (List<String>) hourly.get("time");
            List<Number> temperatures = (List<Number>) hourly.get("temperature_2m");
            List<Number> humidities = (List<Number>) hourly.get("relativehumidity_2m");
            List<Number> precipitations = (List<Number>) hourly.get("precipitation");
            List<Number> windSpeeds = (List<Number>) hourly.get("windspeed_10m");
            List<Number> pressures = (List<Number>) hourly.get("surface_pressure");
            List<Number> solarRadiations = (List<Number>) hourly.get("shortwave_radiation");
            List<Number> soilMoistures = (List<Number>) hourly.get("soil_moisture_0_to_1cm");

            List<WeatherForecastDto.ForecastEntry> entries = new ArrayList<>();
            if (times != null) {
                for (int i = 0; i < times.size(); i++) {
                    Instant time;
                    try {
                        time = OffsetDateTime.parse(times.get(i) + ":00").toInstant();
                    } catch (Exception ex) {
                        time = Instant.now();
                    }

                    Double soilMoisture = (soilMoistures != null && i < soilMoistures.size() && soilMoistures.get(i) != null)
                            ? soilMoistures.get(i).doubleValue() * 100.0
                            : null;

                    entries.add(WeatherForecastDto.ForecastEntry.builder()
                            .time(time)
                            .temperature(getDoubleValue(temperatures, i, 0.0))
                            .humidity(getDoubleValue(humidities, i, 0.0))
                            .precipitation(getDoubleValue(precipitations, i, 0.0))
                            .windSpeed(getDoubleValue(windSpeeds, i, 0.0))
                            .pressure(getDoubleValue(pressures, i, 1013.25))
                            .solarRadiation(getDoubleValue(solarRadiations, i, 0.0))
                            .soilMoisture(soilMoisture)
                            .build());
                }
            }

            return WeatherForecastDto.builder()
                    .fieldId(fieldId)
                    .hourly(entries)
                    .build();

        } catch (Exception e) {
            log.error("Error fetching forecast from Open-Meteo for field {}: {}", fieldId, e.getMessage());
            return WeatherForecastDto.builder()
                    .fieldId(fieldId)
                    .hourly(Collections.emptyList())
                    .build();
        }
    }

    /**
     * Daily historical aggregates from Open-Meteo Archive API (ERA5) when local DB has no readings.
     */
    @SuppressWarnings("unchecked")
    public List<WeatherDataDto> fetchHistoricalDaily(
            UUID fieldId,
            double latitude,
            double longitude,
            Instant start,
            Instant end) {
        try {
            LocalDate startDate = LocalDate.ofInstant(start, ZoneOffset.UTC);
            LocalDate endDate = LocalDate.ofInstant(end, ZoneOffset.UTC);
            if (endDate.isBefore(startDate)) {
                return Collections.emptyList();
            }

            Map<String, Object> response = archiveWebClient.get()
                    .uri(uriBuilder -> uriBuilder
                            .path("/v1/archive")
                            .queryParam("latitude", latitude)
                            .queryParam("longitude", longitude)
                            .queryParam("start_date", startDate.toString())
                            .queryParam("end_date", endDate.toString())
                            .queryParam("timezone", "auto")
                            .queryParam("wind_speed_unit", "ms")
                            .queryParam("daily", "temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max,relative_humidity_2m_mean,shortwave_radiation_sum")
                            .build())
                    .retrieve()
                    .bodyToMono(Map.class)
                    .block();

            if (response == null) {
                return Collections.emptyList();
            }
            Map<String, Object> daily = (Map<String, Object>) response.get("daily");
            if (daily == null) {
                log.warn("Open-Meteo archive: no daily block for field {}", fieldId);
                return Collections.emptyList();
            }

            List<String> times = (List<String>) daily.get("time");
            List<Number> tMax = (List<Number>) daily.get("temperature_2m_max");
            List<Number> tMin = (List<Number>) daily.get("temperature_2m_min");
            List<Number> precip = (List<Number>) daily.get("precipitation_sum");
            List<Number> wind = (List<Number>) daily.get("wind_speed_10m_max");
            List<Number> humidity = (List<Number>) daily.get("relative_humidity_2m_mean");
            List<Number> solar = (List<Number>) daily.get("shortwave_radiation_sum");

            if (times == null || times.isEmpty()) {
                return Collections.emptyList();
            }

            List<WeatherDataDto> rows = new ArrayList<>();
            for (int i = 0; i < times.size(); i++) {
                double maxT = getDoubleValue(tMax, i, 0.0);
                double minT = getDoubleValue(tMin, i, maxT);
                double temp = (maxT + minT) / 2.0;
                String timeStr = times.get(i);
                Instant dayInstant = LocalDate.parse(timeStr.length() >= 10 ? timeStr.substring(0, 10) : timeStr)
                        .atStartOfDay(ZoneOffset.UTC)
                        .toInstant();

                // shortwave_radiation_sum is in MJ/m² per day; convert to avg W/m² (÷ 0.0864)
                double solarWm2 = solar != null ? getDoubleValue(solar, i, 0.0) / 0.0864 : 0.0;

                rows.add(WeatherDataDto.builder()
                        .id(UUID.randomUUID())
                        .fieldId(fieldId)
                        .timestamp(dayInstant)
                        .temperature(temp)
                        .humidity(getDoubleValue(humidity, i, 60.0))
                        .precipitation(getDoubleValue(precip, i, 0.0))
                        .windSpeed(getDoubleValue(wind, i, 0.0))
                        .windDirection(0.0)
                        .pressure(1013.25)
                        .solarRadiation(solarWm2)
                        .soilMoisture(null)
                        .soilTemperature(null)
                        .source("open-meteo-archive")
                        .build());
            }
            return rows;
        } catch (Exception e) {
            log.error("Error fetching historical archive from Open-Meteo for field {}: {}", fieldId, e.getMessage());
            return Collections.emptyList();
        }
    }

    private double getDoubleValue(List<Number> list, int index, double defaultValue) {
        if (list == null || index >= list.size() || list.get(index) == null) {
            return defaultValue;
        }
        return list.get(index).doubleValue();
    }

    private double getDoubleValue(Map<String, Object> map, String key, double defaultValue) {
        Object val = map.get(key);
        if (val instanceof Number) {
            return ((Number) val).doubleValue();
        }
        return defaultValue;
    }

    private double getDoubleValue(List<Number> list, int index, Object fallback) {
        if (list != null && index < list.size() && list.get(index) != null) {
            return list.get(index).doubleValue();
        }
        if (fallback instanceof Number) {
            return ((Number) fallback).doubleValue();
        }
        return 0.0;
    }
}
