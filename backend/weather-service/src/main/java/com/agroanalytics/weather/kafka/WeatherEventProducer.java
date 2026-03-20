package com.agroanalytics.weather.kafka;

import com.agroanalytics.weather.model.WeatherReading;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
public class WeatherEventProducer {

    private static final String WEATHER_TOPIC = "weather-data";

    private final KafkaTemplate<String, WeatherReading> kafkaTemplate;

    public void sendWeatherReading(WeatherReading reading) {
        String key = reading.getFieldId() != null ? reading.getFieldId().toString() : "unknown";
        kafkaTemplate.send(WEATHER_TOPIC, key, reading)
                .whenComplete((result, ex) -> {
                    if (ex != null) {
                        log.error("Failed to send weather reading to Kafka for field {}: {}", key, ex.getMessage());
                    } else {
                        log.debug("Successfully sent weather reading to Kafka for field {}", key);
                    }
                });
    }
}
