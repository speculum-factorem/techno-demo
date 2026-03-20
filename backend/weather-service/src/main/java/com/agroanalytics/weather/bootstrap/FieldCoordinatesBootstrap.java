package com.agroanalytics.weather.bootstrap;

import com.agroanalytics.weather.service.WeatherService;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;

import java.time.Duration;
import java.util.List;
import java.util.UUID;

/**
 * Registers field coordinates in {@link WeatherService} on startup by loading all fields
 * from field-service (survives restarts and works if Kafka events were missed).
 */
@Component
@Order(0)
@RequiredArgsConstructor
@Slf4j
public class FieldCoordinatesBootstrap implements ApplicationRunner {

    private final WeatherService weatherService;
    private final WebClient.Builder webClientBuilder;

    @Value("${agro.field-service.base-url:http://localhost:8082}")
    private String fieldServiceBaseUrl;

    @Value("${agro.field-service.sync-on-startup:true}")
    private boolean syncOnStartup;

    @Value("${agro.internal-api-token:}")
    private String internalApiToken;

    @Override
    public void run(ApplicationArguments args) {
        if (!syncOnStartup) {
            log.info("Field coordinates sync disabled (agro.field-service.sync-on-startup=false)");
            return;
        }
        try {
            WebClient client = webClientBuilder
                    .baseUrl(fieldServiceBaseUrl)
                    .build();

            List<FieldApiRow> fields = client.get()
                    .uri("/api/fields")
                    .headers(headers -> {
                        if (internalApiToken != null && !internalApiToken.isBlank()) {
                            headers.set("X-Internal-Token", internalApiToken);
                        }
                    })
                    .retrieve()
                    .bodyToMono(new ParameterizedTypeReference<List<FieldApiRow>>() {})
                    .timeout(Duration.ofSeconds(20))
                    .block();

            if (fields == null || fields.isEmpty()) {
                log.info("No fields from field-service at {} — weather will use defaults until fields exist",
                        fieldServiceBaseUrl);
                return;
            }

            int registered = 0;
            for (FieldApiRow f : fields) {
                if (f.getId() != null && f.getLat() != null && f.getLng() != null) {
                    weatherService.addFieldCoordinates(f.getId(), f.getLat(), f.getLng());
                    registered++;
                } else {
                    log.warn("Field {} missing lat/lng, skipping weather coordinates", f.getId());
                }
            }
            log.info("Registered coordinates for {} of {} fields from field-service ({})",
                    registered, fields.size(), fieldServiceBaseUrl);
        } catch (Exception e) {
            log.warn("Could not sync field coordinates from {}: {} — Kafka events may still populate data later",
                    fieldServiceBaseUrl, e.getMessage());
        }
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class FieldApiRow {
        private UUID id;
        private Double lat;
        private Double lng;
    }
}
