package com.agroanalytics.weather.dto;

import lombok.*;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class WeatherForecastDto {

    private UUID fieldId;
    private List<ForecastEntry> hourly;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class ForecastEntry {
        private Instant time;
        private double temperature;
        private double humidity;
        private double precipitation;
        private double windSpeed;
        private double pressure;
        private double solarRadiation;
        private Double soilMoisture;
    }
}
