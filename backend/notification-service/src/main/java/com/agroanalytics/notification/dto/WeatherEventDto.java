package com.agroanalytics.notification.dto;

import lombok.*;

import java.time.Instant;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class WeatherEventDto {

    private UUID fieldId;
    private String fieldName;
    private Instant timestamp;
    private double temperature;
    private double humidity;
    private Double soilMoisture;
    private double precipitation;
    private double windSpeed;
    private double pressure;
}
