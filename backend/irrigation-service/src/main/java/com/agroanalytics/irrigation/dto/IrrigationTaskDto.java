package com.agroanalytics.irrigation.dto;

import lombok.Data;
import lombok.Builder;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class IrrigationTaskDto {
    private UUID id;
    private UUID fieldId;
    private String fieldName;
    private LocalDate scheduledDate;
    private Double waterAmount;
    private Integer duration;
    private String priority;
    private String reason;
    private Double moistureDeficit;
    private Double confidence;
    private String status;
    private Instant createdAt;
}
