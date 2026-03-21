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
public class IrrigationEventConsumer {

    private final AlertService alertService;
    private final ObjectMapper objectMapper;

    @KafkaListener(topics = "irrigation-recommendations", groupId = "notification-service")
    public void consumeIrrigationRecommendations(Object message) {
        try {
            Map<String, Object> event = objectMapper.convertValue(message, Map.class);
            if (event == null) {
                log.warn("Received null irrigation-recommendations event, skipping");
                return;
            }
            processIrrigationRecommendation(event);
        } catch (Exception e) {
            log.error("Error processing irrigation-recommendations event: {}", e.getMessage(), e);
        }
    }

    private void processIrrigationRecommendation(Map<String, Object> event) {
        UUID fieldId = parseUuid(event.get("fieldId"));
        Object fieldNameObj = event.get("fieldName");
        String fieldName = (fieldNameObj != null) ? fieldNameObj.toString() : "Unknown Field";
        String recommendation = event.getOrDefault("recommendation", "").toString();
        String priority = event.getOrDefault("priority", "MEDIUM").toString();
        Object waterAmount = event.get("recommendedWaterAmount");
        String reasoning = event.getOrDefault("reasoning", "").toString();

        String severity = mapPriorityToSeverity(priority);

        String waterAmountStr = waterAmount != null
                ? String.format("%.1f мм", Double.parseDouble(waterAmount.toString()))
                : "не указано";

        String message = String.format(
                "Рекомендация для поля '%s': %s. Объём воды: %s.%s",
                fieldName,
                recommendation,
                waterAmountStr,
                reasoning.isEmpty() ? "" : " Причина: " + reasoning
        );

        alertService.createAlert(
                "irrigation",
                severity,
                "Рекомендация по поливу: " + recommendation,
                message,
                fieldId,
                fieldName
        );

        log.info("Processed irrigation recommendation for field {}: priority={}", fieldId, priority);
    }

    private String mapPriorityToSeverity(String priority) {
        if (priority == null) return "info";
        return switch (priority.toUpperCase()) {
            case "HIGH", "URGENT", "CRITICAL" -> "critical";
            case "MEDIUM" -> "warning";
            default -> "info";
        };
    }

    private UUID parseUuid(Object obj) {
        if (obj == null) return null;
        try {
            return UUID.fromString(obj.toString());
        } catch (Exception e) {
            return null;
        }
    }
}
