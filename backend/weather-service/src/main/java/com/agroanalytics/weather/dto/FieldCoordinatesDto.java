package com.agroanalytics.weather.dto;

import lombok.*;

import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class FieldCoordinatesDto {

    private UUID fieldId;
    private String fieldName;
    private double latitude;
    private double longitude;
}
