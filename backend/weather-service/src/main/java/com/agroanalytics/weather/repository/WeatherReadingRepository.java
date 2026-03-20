package com.agroanalytics.weather.repository;

import com.agroanalytics.weather.model.WeatherReading;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Repository
public interface WeatherReadingRepository extends JpaRepository<WeatherReading, UUID> {

    List<WeatherReading> findByFieldIdOrderByTimestampDesc(UUID fieldId);

    List<WeatherReading> findByFieldIdAndTimestampBetween(UUID fieldId, Instant start, Instant end);
}
