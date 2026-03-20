package com.agroanalytics.field.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class FieldSatelliteDto {
    private String fieldId;
    private String fieldName;
    private List<IndexPoint> timeline;
    private Double latestNdvi;
    private Double latestNdmi;
    private String stressLevel;
    private String mapPreviewUrl;
    private List<String> alerts;
    private List<String> recommendations;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class IndexPoint {
        private LocalDate date;
        private Double ndvi;
        private Double ndmi;
    }
}
