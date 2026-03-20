package com.agroanalytics.notification.kafka;

import com.agroanalytics.notification.service.AlertService;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.UUID;

@Component
@RequiredArgsConstructor
@Slf4j
public class WeatherEventConsumer {

    private final AlertService alertService;
    private final ObjectMapper objectMapper;

    @KafkaListener(topics = "weather-data", groupId = "notification-service")
    public void consumeWeatherData(Object message) {
        try {
            Map<String, Object> event = objectMapper.convertValue(message, Map.class);
            processWeatherEvent(event);
        } catch (Exception e) {
            log.error("Error processing weather-data event: {}", e.getMessage(), e);
        }
    }

    @KafkaListener(topics = "forecast-results", groupId = "notification-service")
    public void consumeForecastResults(Object message) {
        try {
            Map<String, Object> event = objectMapper.convertValue(message, Map.class);
            processForecastEvent(event);
        } catch (Exception e) {
            log.error("Error processing forecast-results event: {}", e.getMessage(), e);
        }
    }

    private void processWeatherEvent(Map<String, Object> event) {
        UUID fieldId = parseUuid(event.get("fieldId"));
        String fieldName = event.getOrDefault("fieldName", "Unknown Field").toString();
        Double soilMoisture = parseDouble(event.get("soilMoisture"));
        double temperature = parseDoubleOrDefault(event.get("temperature"), 0.0);
        double humidity = parseDoubleOrDefault(event.get("humidity"), 0.0);
        double precipitation = parseDoubleOrDefault(event.get("precipitation"), 0.0);

        log.debug("Received weather event for field {}: soilMoisture={}, temp={}", fieldId, soilMoisture, temperature);

        if (soilMoisture != null) {
            if (soilMoisture < 40.0) {
                alertService.createAlert(
                        "SOIL_MOISTURE",
                        "CRITICAL",
                        "Critical Soil Moisture Level",
                        String.format("Soil moisture is critically low at %.1f%% for field '%s'. Immediate irrigation required.",
                                soilMoisture, fieldName),
                        fieldId,
                        fieldName
                );
            } else if (soilMoisture < 55.0) {
                alertService.createAlert(
                        "SOIL_MOISTURE",
                        "WARNING",
                        "Low Soil Moisture Warning",
                        String.format("Soil moisture is below optimal at %.1f%% for field '%s'. Consider irrigation soon.",
                                soilMoisture, fieldName),
                        fieldId,
                        fieldName
                );
            }
        }

        // Additional weather-based alerts
        if (temperature > 38.0) {
            alertService.createAlert(
                    "HIGH_TEMPERATURE",
                    "WARNING",
                    "High Temperature Alert",
                    String.format("Temperature is %.1f°C for field '%s'. Heat stress risk for crops.", temperature, fieldName),
                    fieldId,
                    fieldName
            );
        }

        if (precipitation > 50.0) {
            alertService.createAlert(
                    "HEAVY_RAIN",
                    "WARNING",
                    "Heavy Precipitation Alert",
                    String.format("High precipitation of %.1fmm detected for field '%s'. Check drainage.", precipitation, fieldName),
                    fieldId,
                    fieldName
            );
        }
    }

    private void processForecastEvent(Map<String, Object> event) {
        UUID fieldId = parseUuid(event.get("fieldId"));
        String fieldName = event.getOrDefault("fieldName", "Unknown Field").toString();
        String forecastSummary = event.getOrDefault("summary", "Forecast update available").toString();

        alertService.createAlert(
                "FORECAST_UPDATE",
                "INFO",
                "Weather Forecast Updated",
                String.format("New weather forecast available for field '%s': %s", fieldName, forecastSummary),
                fieldId,
                fieldName
        );
    }

    private UUID parseUuid(Object obj) {
        if (obj == null) return null;
        try {
            return UUID.fromString(obj.toString());
        } catch (Exception e) {
            return null;
        }
    }

    private Double parseDouble(Object obj) {
        if (obj == null) return null;
        try {
            return Double.parseDouble(obj.toString());
        } catch (Exception e) {
            return null;
        }
    }

    private double parseDoubleOrDefault(Object obj, double defaultValue) {
        if (obj == null) return defaultValue;
        try {
            return Double.parseDouble(obj.toString());
        } catch (Exception e) {
            return defaultValue;
        }
    }
}
