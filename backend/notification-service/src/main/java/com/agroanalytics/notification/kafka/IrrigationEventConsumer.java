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
            processIrrigationRecommendation(event);
        } catch (Exception e) {
            log.error("Error processing irrigation-recommendations event: {}", e.getMessage(), e);
        }
    }

    private void processIrrigationRecommendation(Map<String, Object> event) {
        UUID fieldId = parseUuid(event.get("fieldId"));
        String fieldName = event.getOrDefault("fieldName", "Unknown Field").toString();
        String recommendation = event.getOrDefault("recommendation", "").toString();
        String priority = event.getOrDefault("priority", "MEDIUM").toString();
        Object waterAmount = event.get("recommendedWaterAmount");
        String reasoning = event.getOrDefault("reasoning", "").toString();

        String severity = mapPriorityToSeverity(priority);

        String waterAmountStr = waterAmount != null
                ? String.format("%.1f mm", Double.parseDouble(waterAmount.toString()))
                : "unspecified amount";

        String message = String.format(
                "Irrigation recommendation for field '%s': %s. Recommended water: %s.%s",
                fieldName,
                recommendation,
                waterAmountStr,
                reasoning.isEmpty() ? "" : " Reason: " + reasoning
        );

        alertService.createAlert(
                "IRRIGATION_RECOMMENDATION",
                severity,
                "Irrigation Recommendation: " + recommendation,
                message,
                fieldId,
                fieldName
        );

        log.info("Processed irrigation recommendation for field {}: priority={}", fieldId, priority);
    }

    private String mapPriorityToSeverity(String priority) {
        if (priority == null) return "INFO";
        return switch (priority.toUpperCase()) {
            case "HIGH", "URGENT" -> "CRITICAL";
            case "MEDIUM" -> "WARNING";
            default -> "INFO";
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
