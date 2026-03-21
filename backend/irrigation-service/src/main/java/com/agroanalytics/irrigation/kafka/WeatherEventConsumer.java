package com.agroanalytics.irrigation.kafka;

import com.agroanalytics.irrigation.model.IrrigationTask;
import com.agroanalytics.irrigation.repository.IrrigationTaskRepository;
import com.agroanalytics.irrigation.service.IrrigationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Crop-specific soil moisture thresholds (% field capacity).
 * Source: agronomical norms for the Rostov region (Центр-Инвест case).
 *
 *  Crop         | Warning threshold | Critical threshold | Target moisture
 *  -------------|-------------------|--------------------|-----------------
 *  wheat        | 60%               | 45%                | 65%
 *  corn         | 65%               | 50%                | 70%
 *  sunflower    | 55%               | 40%                | 60%
 *  barley       | 55%               | 40%                | 60%
 *  soy          | 65%               | 50%                | 70%
 *  sugar_beet   | 70%               | 55%                | 75%
 *  other        | 55%               | 40%                | 60%
 */

@Component
@RequiredArgsConstructor
@Slf4j
public class WeatherEventConsumer {

    private final IrrigationService irrigationService;
    private final IrrigationTaskRepository taskRepository;

    // [warningThreshold, criticalThreshold, targetMoisture]
    private static final Map<String, double[]> CROP_THRESHOLDS = Map.of(
            "wheat",      new double[]{60, 45, 65},
            "corn",       new double[]{65, 50, 70},
            "sunflower",  new double[]{55, 40, 60},
            "barley",     new double[]{55, 40, 60},
            "soy",        new double[]{65, 50, 70},
            "sugar_beet", new double[]{70, 55, 75}
    );
    private static final double[] DEFAULT_THRESHOLDS = {55, 40, 60};

    @KafkaListener(topics = "weather-data", groupId = "irrigation-service")
    public void handleWeatherEvent(Map<String, Object> event) {
        try {
            String fieldIdStr = String.valueOf(event.get("fieldId"));
            Object soilMoistureObj = event.get("soilMoisture");

            if (soilMoistureObj == null) return;

            double soilMoisture = Double.parseDouble(soilMoistureObj.toString());

            String cropType = event.get("cropType") != null
                    ? event.get("cropType").toString().toLowerCase()
                    : "other";
            double[] thresholds = CROP_THRESHOLDS.getOrDefault(cropType, DEFAULT_THRESHOLDS);
            double warningThreshold  = thresholds[0];
            double criticalThreshold = thresholds[1];
            double targetMoisture    = thresholds[2];

            if (soilMoisture < warningThreshold) {
                UUID fieldId = UUID.fromString(fieldIdStr);
                LocalDate today = LocalDate.now();

                // Guard: skip if ANY task (including completed/cancelled/skipped) already exists for this field today
                // This prevents re-creating tasks after completion on the same day
                boolean alreadyScheduled = taskRepository.existsByFieldIdAndScheduledDateAndStatusIn(
                        fieldId, today,
                        List.of(IrrigationTask.Status.scheduled, IrrigationTask.Status.active,
                                IrrigationTask.Status.completed, IrrigationTask.Status.cancelled,
                                IrrigationTask.Status.skipped)
                );
                if (alreadyScheduled) {
                    log.debug("Irrigation task already exists for field {} on {}, skipping duplicate", fieldId, today);
                    return;
                }

                boolean isCritical = soilMoisture < criticalThreshold;
                double deficit = targetMoisture - soilMoisture;
                // Water amount: ~1 mm per 1% deficit (simplified agronomical norm)
                double waterAmount = Math.round(deficit * 1.2 * 10.0) / 10.0;
                int duration = (int) Math.round(waterAmount * 4); // ~4 min per mm

                log.warn("Low soil moisture for field {} (crop={}): {}% < threshold {}%",
                        fieldId, cropType, String.format("%.1f", soilMoisture), String.format("%.1f", warningThreshold));

                IrrigationTask task = IrrigationTask.builder()
                        .fieldId(fieldId)
                        .fieldName("Поле " + fieldIdStr)
                        .scheduledDate(today)
                        .waterAmount(waterAmount)
                        .duration(duration)
                        .priority(isCritical ? IrrigationTask.Priority.critical : IrrigationTask.Priority.high)
                        .reason(String.format(
                                "Автоматическое обнаружение (%s): влажность почвы %.0f%% ниже порога %.0f%% (цель %.0f%%)",
                                cropType, soilMoisture, warningThreshold, targetMoisture))
                        .moistureDeficit(deficit)
                        .confidence(isCritical ? 95.0 : 85.0)
                        .status(IrrigationTask.Status.scheduled)
                        .build();

                irrigationService.createTask(task);
            }
        } catch (Exception e) {
            log.error("Error processing weather event: {}", e.getMessage());
        }
    }
}
