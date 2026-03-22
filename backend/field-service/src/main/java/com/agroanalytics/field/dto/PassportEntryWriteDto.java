package com.agroanalytics.field.dto;

import com.agroanalytics.field.model.PassportEntryCategory;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.time.LocalDate;

@Data
public class PassportEntryWriteDto {

    @NotNull
    private PassportEntryCategory category;

    @NotNull
    private LocalDate date;

    @NotBlank
    private String type;

    private String description;

    private Double amount;

    private String unit;

    private Double cost;
}
