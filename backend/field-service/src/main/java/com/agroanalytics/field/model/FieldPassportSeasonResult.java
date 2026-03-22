package com.agroanalytics.field.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "field_passport_season_results")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class FieldPassportSeasonResult {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "field_id", nullable = false)
    private UUID fieldId;

    @Column(nullable = false, length = 32)
    private String season;

    @Column(name = "crop_type", length = 64)
    private String cropType;

    @Column(name = "yield_actual")
    private Double yieldActual;

    @Column(name = "yield_plan")
    private Double yieldPlan;

    @Column(name = "revenue_actual")
    private Double revenueActual;

    @Column(name = "cost_actual")
    private Double costActual;

    @Column(name = "sort_order", nullable = false)
    @Builder.Default
    private int sortOrder = 0;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
}
