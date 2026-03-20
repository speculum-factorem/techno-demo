package com.agroanalytics.irrigation.kafka;

import com.agroanalytics.irrigation.model.IrrigationTask;
import com.agroanalytics.irrigation.service.IrrigationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;

@Component
@RequiredArgsConstructor
@Slf4j
public class WeatherEventConsumer {

    private final IrrigationService irrigationService;

    @KafkaListener(topics = "weather-data", groupId = "irrigation-service")
    public void handleWeatherEvent(Map<String, Object> event) {
        try {
            String fieldId = String.valueOf(event.get("fieldId"));
            Object soilMoistureObj = event.get("soilMoisture");

            if (soilMoistureObj == null) return;

            double soilMoisture = Double.parseDouble(soilMoistureObj.toString());

            if (soilMoisture < 40) {
                log.warn("Low soil moisture detected for field {}: {}%", fieldId, soilMoisture);
                IrrigationTask task = IrrigationTask.builder()
                        .fieldId(UUID.fromString(fieldId))
                        .fieldName("Поле " + fieldId)
                        .scheduledDate(LocalDate.now())
                        .waterAmount(soilMoisture < 30 ? 50.0 : 30.0)
                        .duration(soilMoisture < 30 ? 200 : 120)
                        .priority(soilMoisture < 30 ? IrrigationTask.Priority.critical : IrrigationTask.Priority.high)
                        .reason(String.format("Автоматическое обнаружение: влажность почвы %.0f%% ниже критического порога", soilMoisture))
                        .moistureDeficit(60.0 - soilMoisture)
                        .confidence(soilMoisture < 30 ? 95.0 : 85.0)
                        .status(IrrigationTask.Status.scheduled)
                        .build();

                irrigationService.createTask(task);
            }
        } catch (Exception e) {
            log.error("Error processing weather event: {}", e.getMessage());
        }
    }
}
