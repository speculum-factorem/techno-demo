package com.agroanalytics.weather.service;

import com.agroanalytics.weather.dto.WeatherDataDto;
import com.agroanalytics.weather.dto.WeatherForecastDto;
import com.agroanalytics.weather.dto.WeatherSummaryDto;
import com.agroanalytics.weather.kafka.WeatherEventProducer;
import com.agroanalytics.weather.model.WeatherReading;
import com.agroanalytics.weather.repository.WeatherReadingRepository;
import com.github.benmanes.caffeine.cache.Cache;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

@Service
@Slf4j
public class WeatherService {

    private final WeatherReadingRepository weatherReadingRepository;
    private final OpenMeteoService openMeteoService;
    private final WeatherEventProducer weatherEventProducer;
    private final Cache<UUID, WeatherDataDto> staleCurrentWeatherCache;
    private final Cache<UUID, WeatherForecastDto> staleForecastCache;
    private final double defaultLatitude;
    private final double defaultLongitude;

    private final Map<UUID, double[]> fieldCoordinates = new LinkedHashMap<>();

    public WeatherService(
            WeatherReadingRepository weatherReadingRepository,
            OpenMeteoService openMeteoService,
            WeatherEventProducer weatherEventProducer,
            Cache<UUID, WeatherDataDto> staleCurrentWeatherCache,
            Cache<UUID, WeatherForecastDto> staleForecastCache,
            @Value("${agro.weather.default-latitude:47.2357}") double defaultLatitude,
            @Value("${agro.weather.default-longitude:39.7015}") double defaultLongitude) {
        this.weatherReadingRepository = weatherReadingRepository;
        this.openMeteoService = openMeteoService;
        this.weatherEventProducer = weatherEventProducer;
        this.staleCurrentWeatherCache = staleCurrentWeatherCache;
        this.staleForecastCache = staleForecastCache;
        this.defaultLatitude = defaultLatitude;
        this.defaultLongitude = defaultLongitude;
    }

    public void addFieldCoordinates(UUID fieldId, double latitude, double longitude) {
        fieldCoordinates.put(fieldId, new double[]{latitude, longitude});
    }

    private double[] resolveCoordinatesWithFallback(UUID fieldId) {
        double[] coords = fieldCoordinates.get(fieldId);
        if (coords != null) {
            return coords;
        }
        log.warn("No coordinates for field {}, using agro.weather defaults ({}, {})",
                fieldId, defaultLatitude, defaultLongitude);
        return new double[]{defaultLatitude, defaultLongitude};
    }

    public WeatherDataDto getLatestByField(UUID fieldId) {
        List<WeatherReading> readings = weatherReadingRepository.findByFieldIdOrderByTimestampDesc(fieldId);
        if (readings.isEmpty()) {
            double[] coords = resolveCoordinatesWithFallback(fieldId);
            WeatherReading reading = openMeteoService.fetchCurrentWeather(fieldId, coords[0], coords[1]);
            if (reading != null) {
                reading = weatherReadingRepository.save(reading);
                weatherEventProducer.sendWeatherReading(reading);
                WeatherDataDto dto = toDto(reading);
                staleCurrentWeatherCache.put(fieldId, dto);
                return dto;
            }
            WeatherDataDto stale = staleCurrentWeatherCache.getIfPresent(fieldId);
            if (stale != null) {
                log.warn("Open-Meteo unavailable: returning stale current weather for field {}", fieldId);
                return stale;
            }
            return null;
        }
        WeatherDataDto dto = toDto(readings.get(0));
        staleCurrentWeatherCache.put(fieldId, dto);
        return dto;
    }

    public List<WeatherDataDto> getHistorical(UUID fieldId, Instant start, Instant end) {
        List<WeatherReading> readings = weatherReadingRepository.findByFieldIdAndTimestampBetween(fieldId, start, end);
        if (!readings.isEmpty()) {
            return readings.stream().map(this::toDto).collect(Collectors.toList());
        }

        if (!fieldCoordinates.containsKey(fieldId)) {
            log.info("No readings in DB and no coordinates for field {} — skip archive backfill", fieldId);
            return Collections.emptyList();
        }

        double[] coords = fieldCoordinates.get(fieldId);
        List<WeatherDataDto> archive = openMeteoService.fetchHistoricalDaily(
                fieldId, coords[0], coords[1], start, end);
        if (archive == null) {
            return Collections.emptyList();
        }
        log.info("Supplied {} historical archive days for field {}", archive.size(), fieldId);
        return archive;
    }

    public WeatherForecastDto getForecast(UUID fieldId) {
        double[] coords = resolveCoordinatesWithFallback(fieldId);
        WeatherForecastDto forecast = openMeteoService.fetchForecast(fieldId, coords[0], coords[1]);
        if (forecast.getHourly() != null && !forecast.getHourly().isEmpty()) {
            staleForecastCache.put(fieldId, forecast);
            return forecast;
        }
        WeatherForecastDto stale = staleForecastCache.getIfPresent(fieldId);
        if (stale != null && stale.getHourly() != null && !stale.getHourly().isEmpty()) {
            log.warn("Open-Meteo forecast empty: returning stale forecast for field {}", fieldId);
            return stale;
        }
        return forecast;
    }

    public WeatherSummaryDto getSummary(UUID fieldId, int days) {
        Instant end = Instant.now();
        Instant start = end.minus(days, ChronoUnit.DAYS);
        List<WeatherReading> readings = weatherReadingRepository.findByFieldIdAndTimestampBetween(fieldId, start, end);

        if (readings.isEmpty()) {
            return WeatherSummaryDto.builder()
                    .fieldId(fieldId)
                    .readingCount(0)
                    .periodDescription("Last " + days + " days")
                    .build();
        }

        DoubleSummaryStatistics tempStats = readings.stream()
                .mapToDouble(WeatherReading::getTemperature)
                .summaryStatistics();

        double avgHumidity = readings.stream().mapToDouble(WeatherReading::getHumidity).average().orElse(0.0);
        double totalPrecipitation = readings.stream().mapToDouble(WeatherReading::getPrecipitation).sum();
        double avgWindSpeed = readings.stream().mapToDouble(WeatherReading::getWindSpeed).average().orElse(0.0);
        double avgPressure = readings.stream().mapToDouble(WeatherReading::getPressure).average().orElse(0.0);
        double avgSolarRadiation = readings.stream().mapToDouble(WeatherReading::getSolarRadiation).average().orElse(0.0);

        OptionalDouble avgSoilMoistureOpt = readings.stream()
                .filter(r -> r.getSoilMoisture() != null)
                .mapToDouble(WeatherReading::getSoilMoisture)
                .average();

        return WeatherSummaryDto.builder()
                .fieldId(fieldId)
                .avgTemperature(tempStats.getAverage())
                .minTemperature(tempStats.getMin())
                .maxTemperature(tempStats.getMax())
                .avgHumidity(avgHumidity)
                .totalPrecipitation(totalPrecipitation)
                .avgWindSpeed(avgWindSpeed)
                .avgPressure(avgPressure)
                .avgSolarRadiation(avgSolarRadiation)
                .avgSoilMoisture(avgSoilMoistureOpt.isPresent() ? avgSoilMoistureOpt.getAsDouble() : null)
                .readingCount(readings.size())
                .periodDescription("Last " + days + " days")
                .build();
    }

    @Scheduled(fixedDelay = 600000)
    public void fetchAndStoreWeatherForAllFields() {
        if (fieldCoordinates.isEmpty()) {
            log.info("No field coordinates registered, skipping scheduled weather fetch");
            return;
        }

        log.info("Fetching weather data for {} fields", fieldCoordinates.size());
        for (Map.Entry<UUID, double[]> entry : fieldCoordinates.entrySet()) {
            UUID fieldId = entry.getKey();
            double[] coords = entry.getValue();
            try {
                WeatherReading reading = openMeteoService.fetchCurrentWeather(fieldId, coords[0], coords[1]);
                if (reading != null) {
                    WeatherReading saved = weatherReadingRepository.save(reading);
                    weatherEventProducer.sendWeatherReading(saved);
                    staleCurrentWeatherCache.put(fieldId, toDto(saved));
                    log.info("Saved and published weather reading for field {}", fieldId);
                }
            } catch (Exception e) {
                log.error("Error fetching weather for field {}: {}", fieldId, e.getMessage());
            }
        }
    }

    private WeatherDataDto toDto(WeatherReading r) {
        return WeatherDataDto.builder()
                .id(r.getId())
                .fieldId(r.getFieldId())
                .timestamp(r.getTimestamp())
                .temperature(r.getTemperature())
                .humidity(r.getHumidity())
                .precipitation(r.getPrecipitation())
                .windSpeed(r.getWindSpeed())
                .windDirection(r.getWindDirection())
                .pressure(r.getPressure())
                .solarRadiation(r.getSolarRadiation())
                .soilMoisture(r.getSoilMoisture())
                .soilTemperature(r.getSoilTemperature())
                .source(r.getSource())
                .build();
    }
}
