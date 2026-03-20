package com.agroanalytics.field.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CreateFieldDto {

    @NotBlank(message = "Field name is required")
    private String name;

    @NotNull(message = "Area is required")
    private Double area;

    private String cropType;

    private String status;

    @NotNull(message = "Latitude is required")
    private Double lat;

    @NotNull(message = "Longitude is required")
    private Double lng;

    private String soilType;
    private LocalDate plantingDate;
    private LocalDate expectedHarvestDate;
    private Double currentMoistureLevel;
    private Long organizationId;
}
