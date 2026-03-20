package com.agroanalytics.irrigation.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "irrigation_tasks")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class IrrigationTask {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private UUID fieldId;

    private String fieldName;

    private LocalDate scheduledDate;

    private Double waterAmount;   // mm

    private Integer duration;     // minutes

    @Enumerated(EnumType.STRING)
    private Priority priority;

    private String reason;

    private Double moistureDeficit;

    private Double confidence;

    @Enumerated(EnumType.STRING)
    private Status status;

    private Instant createdAt;

    private Instant executedAt;

    public enum Priority {
        critical, high, medium, low
    }

    public enum Status {
        scheduled, active, completed, cancelled, skipped
    }
}
