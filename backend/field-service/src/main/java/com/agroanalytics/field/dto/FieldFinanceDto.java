package com.agroanalytics.field.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class FieldFinanceDto {
    private String fieldId;
    private String fieldName;
    private Double planCost;
    private Double actualCost;
    private Double costPerHectare;
    private Double waterSavingPercent;
    private Double grossRevenue;
    private Double margin;
    private Double marginPercent;
    private List<CostBreakdownItem> breakdown;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class CostBreakdownItem {
        private String category;
        private Double planned;
        private Double actual;
    }
}
