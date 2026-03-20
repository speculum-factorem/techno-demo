package com.agroanalytics.notification.dto;

import lombok.*;

import java.time.Instant;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class IrrigationRecommendationDto {

    private UUID fieldId;
    private String fieldName;
    private String recommendation;
    private String priority;
    private double recommendedWaterAmount;
    private Instant generatedAt;
    private String reasoning;
}
