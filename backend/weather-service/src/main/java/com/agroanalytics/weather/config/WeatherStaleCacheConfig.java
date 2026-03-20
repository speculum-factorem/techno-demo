package com.agroanalytics.weather.config;

import com.agroanalytics.weather.dto.WeatherDataDto;
import com.agroanalytics.weather.dto.WeatherForecastDto;
import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.UUID;
import java.util.concurrent.TimeUnit;

@Configuration
public class WeatherStaleCacheConfig {

    /**
     * Last successful current observations (fallback when Open-Meteo is temporarily unavailable).
     */
    @Bean
    public Cache<UUID, WeatherDataDto> staleCurrentWeatherCache() {
        return Caffeine.newBuilder()
                .maximumSize(50_000)
                .expireAfterWrite(36, TimeUnit.HOURS)
                .build();
    }

    /**
     * Last successful hourly forecast snapshot.
     */
    @Bean
    public Cache<UUID, WeatherForecastDto> staleForecastCache() {
        return Caffeine.newBuilder()
                .maximumSize(50_000)
                .expireAfterWrite(36, TimeUnit.HOURS)
                .build();
    }
}
