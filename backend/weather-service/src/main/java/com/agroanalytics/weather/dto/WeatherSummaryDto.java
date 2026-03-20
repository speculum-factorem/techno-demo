package com.agroanalytics.weather.dto;

import lombok.*;

import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class WeatherSummaryDto {

    private UUID fieldId;
    private double avgTemperature;
    private double minTemperature;
    private double maxTemperature;
    private double avgHumidity;
    private double totalPrecipitation;
    private double avgWindSpeed;
    private double avgPressure;
    private double avgSolarRadiation;
    private Double avgSoilMoisture;
    private int readingCount;
    private String periodDescription;
}
