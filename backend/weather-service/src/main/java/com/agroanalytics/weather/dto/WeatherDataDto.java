package com.agroanalytics.weather.dto;

import lombok.*;

import java.time.Instant;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class WeatherDataDto {

    private UUID id;
    private UUID fieldId;
    private Instant timestamp;
    private double temperature;
    private double humidity;
    private double precipitation;
    private double windSpeed;
    private double windDirection;
    private double pressure;
    private double solarRadiation;
    private Double soilMoisture;
    private Double soilTemperature;
    private String source;
}
