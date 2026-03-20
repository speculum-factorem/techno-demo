package com.agroanalytics.field.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class FieldDto {

    private UUID id;
    private String name;
    private Double area;
    private String cropType;
    private String status;
    private Double lat;
    private Double lng;
    private String soilType;
    private LocalDate plantingDate;
    private LocalDate expectedHarvestDate;
    private Double currentMoistureLevel;
    private Long organizationId;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
