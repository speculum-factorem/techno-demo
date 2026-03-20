package com.agroanalytics.weather.kafka;

import com.agroanalytics.weather.service.WeatherService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.UUID;

/**
 * Listens to field-events from field-service.
 * When a field is created or updated, registers its coordinates with WeatherService
 * so the scheduler can start fetching real weather data for it.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class FieldEventConsumer {

    private final WeatherService weatherService;

    @KafkaListener(topics = "field-events", groupId = "weather-service-fields")
    public void onFieldEvent(Map<String, Object> message) {
        try {
            String eventType = (String) message.get("eventType");
            if (!"FIELD_CREATED".equals(eventType) && !"FIELD_UPDATED".equals(eventType)) {
                return;
            }

            Object payloadObj = message.get("payload");
            if (!(payloadObj instanceof Map)) return;

            @SuppressWarnings("unchecked")
            Map<String, Object> payload = (Map<String, Object>) payloadObj;

            String fieldIdStr = (String) payload.get("id");
            Object latObj = payload.get("lat");
            Object lngObj = payload.get("lng");

            if (fieldIdStr == null || latObj == null || lngObj == null) {
                log.warn("Field event missing id/lat/lng, skipping: {}", payload);
                return;
            }

            UUID fieldId = UUID.fromString(fieldIdStr);
            double lat = ((Number) latObj).doubleValue();
            double lng = ((Number) lngObj).doubleValue();

            weatherService.addFieldCoordinates(fieldId, lat, lng);
            log.info("Registered coordinates for field {} from {} event: ({}, {})", fieldId, eventType, lat, lng);

        } catch (Exception e) {
            log.error("Error processing field event: {}", e.getMessage(), e);
        }
    }
}
