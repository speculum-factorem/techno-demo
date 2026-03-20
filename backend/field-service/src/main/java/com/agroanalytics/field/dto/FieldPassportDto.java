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
public class FieldPassportDto {
    private String fieldId;
    private String fieldName;
    private List<OperationRecord> operations;
    private List<OperationRecord> fertilizers;
    private List<OperationRecord> treatments;
    private List<ResultRecord> results;
    private PassportTotals totals;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class OperationRecord {
        private LocalDate date;
        private String type;
        private String description;
        private Double amount;
        private String unit;
        private Double cost;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class ResultRecord {
        private String metric;
        private Double value;
        private String unit;
        private String period;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class PassportTotals {
        private Double totalCost;
        private Double totalFertilizerKg;
        private Double totalWaterM3;
        private Integer operationsCount;
    }
}
