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
                        "weather",
                        "critical",
                        "Критически низкая влажность почвы",
                        String.format("Влажность почвы на поле '%s' критически низкая: %.1f%%. Требуется немедленный полив.",
                                fieldName, soilMoisture),
                        fieldId,
                        fieldName
                );
            } else if (soilMoisture < 55.0) {
                alertService.createAlert(
                        "weather",
                        "warning",
                        "Низкая влажность почвы",
                        String.format("Влажность почвы на поле '%s' ниже оптимальной: %.1f%%. Рекомендуется полив.",
                                fieldName, soilMoisture),
                        fieldId,
                        fieldName
                );
            }
        }

        // Additional weather-based alerts
        if (temperature > 38.0) {
            alertService.createAlert(
                    "weather",
                    "warning",
                    "Высокая температура",
                    String.format("Температура на поле '%s': %.1f°C. Возможен тепловой стресс культур.", fieldName, temperature),
                    fieldId,
                    fieldName
            );
        }

        if (precipitation > 50.0) {
            alertService.createAlert(
                    "weather",
                    "warning",
                    "Сильные осадки",
                    String.format("На поле '%s' зафиксированы сильные осадки: %.1f мм. Проверьте дренаж.", fieldName, precipitation),
                    fieldId,
                    fieldName
            );
        }
    }

    private void processForecastEvent(Map<String, Object> event) {
        UUID fieldId = parseUuid(event.get("fieldId"));
        String fieldName = event.getOrDefault("fieldName", "Unknown Field").toString();
        String confidence = event.getOrDefault("confidence", "HIGH").toString();
        double predictedYield = parseDoubleOrDefault(event.get("predictedYield"), -1.0);

        // Only create an alert when the model signals LOW confidence or yield is critically low.
        // Routine HIGH/MEDIUM forecasts are not stored as alerts to avoid DB spam.
        if ("LOW".equalsIgnoreCase(confidence)) {
            alertService.createAlert(
                    "forecast",
                    "warning",
                    "Прогноз урожайности с низкой достоверностью",
                    String.format("Прогноз для поля '%s': %.2f т/га, достоверность LOW. " +
                            "Возможны аномальные входные данные — рекомендуется проверить датчики.", fieldName, predictedYield),
                    fieldId,
                    fieldName
            );
        } else if (predictedYield >= 0 && predictedYield < 1.5) {
            alertService.createAlert(
                    "forecast",
                    "critical",
                    "Критически низкий прогноз урожайности",
                    String.format("Прогноз для поля '%s': %.2f т/га — значительно ниже нормы. Требуется вмешательство агронома.", fieldName, predictedYield),
                    fieldId,
                    fieldName
            );
        } else {
            log.debug("Routine forecast for field {} (confidence={}, yield={}): no alert created", fieldId, confidence, predictedYield);
        }
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
