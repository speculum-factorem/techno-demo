package com.agroanalytics.field.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "field_passport_entries")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class FieldPassportEntry {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "field_id", nullable = false)
    private UUID fieldId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private PassportEntryCategory category;

    @Column(name = "operation_date", nullable = false)
    private LocalDate operationDate;

    @Column(name = "operation_type", nullable = false, length = 64)
    private String operationType;

    @Column(length = 512)
    private String description;

    private Double amount;

    @Column(length = 32)
    private String unit;

    private Double cost;

    @Column(name = "sort_order", nullable = false)
    @Builder.Default
    private int sortOrder = 0;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
}
