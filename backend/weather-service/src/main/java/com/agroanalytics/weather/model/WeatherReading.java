package com.agroanalytics.weather.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.GenericGenerator;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "weather_readings")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class WeatherReading {

    @Id
    @GeneratedValue(generator = "UUID")
    @GenericGenerator(name = "UUID", strategy = "org.hibernate.id.UUIDGenerator")
    @Column(updatable = false, nullable = false)
    private UUID id;

    @Column(nullable = false)
    private UUID fieldId;

    @Column(nullable = false)
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

    @Column(length = 50)
    private String source;
}
