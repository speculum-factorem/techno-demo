package com.agroanalytics.weather.controller;

import com.agroanalytics.weather.dto.WeatherDataDto;
import com.agroanalytics.weather.dto.WeatherForecastDto;
import com.agroanalytics.weather.dto.WeatherSummaryDto;
import com.agroanalytics.weather.service.WeatherService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/weather/fields")
@RequiredArgsConstructor
@Slf4j
public class WeatherController {

    private final WeatherService weatherService;

    @GetMapping("/{fieldId}/current")
    public ResponseEntity<WeatherDataDto> getCurrentWeather(@PathVariable UUID fieldId) {
        WeatherDataDto dto = weatherService.getLatestByField(fieldId);
        if (dto == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(dto);
    }

    @GetMapping("/{fieldId}/historical")
    public ResponseEntity<List<WeatherDataDto>> getHistoricalWeather(
            @PathVariable UUID fieldId,
            @RequestParam(required = false) String start,
            @RequestParam(required = false) String end) {

        Instant startInstant = start != null ? Instant.parse(start) : Instant.now().minusSeconds(86400 * 7);
        Instant endInstant = end != null ? Instant.parse(end) : Instant.now();

        List<WeatherDataDto> data = weatherService.getHistorical(fieldId, startInstant, endInstant);
        return ResponseEntity.ok(data);
    }

    @GetMapping("/{fieldId}/forecast")
    public ResponseEntity<WeatherForecastDto> getForecast(@PathVariable UUID fieldId) {
        WeatherForecastDto forecast = weatherService.getForecast(fieldId);
        return ResponseEntity.ok(forecast);
    }

    @GetMapping("/{fieldId}/summary")
    public ResponseEntity<WeatherSummaryDto> getSummary(
            @PathVariable UUID fieldId,
            @RequestParam(defaultValue = "7") int days) {
        WeatherSummaryDto summary = weatherService.getSummary(fieldId, days);
        return ResponseEntity.ok(summary);
    }

    @PostMapping("/{fieldId}/coordinates")
    public ResponseEntity<Void> registerFieldCoordinates(
            @PathVariable UUID fieldId,
            @RequestParam double latitude,
            @RequestParam double longitude) {
        weatherService.addFieldCoordinates(fieldId, latitude, longitude);
        log.info("Registered coordinates for field {}: ({}, {})", fieldId, latitude, longitude);
        return ResponseEntity.ok().build();
    }
}
