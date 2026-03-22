package com.agroanalytics.field.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class SeasonResultWriteDto {

    @NotBlank
    private String season;

    private String cropType;

    private Double yieldActual;

    private Double yieldPlan;

    private Double revenueActual;

    private Double costActual;
}
