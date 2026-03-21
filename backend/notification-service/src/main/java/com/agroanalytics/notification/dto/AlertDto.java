package com.agroanalytics.notification.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AlertDto {

    private UUID id;
    private String type;
    private String severity;
    private String title;
    private String message;
    private UUID fieldId;
    private String fieldName;
    @JsonProperty("isRead")
    private boolean isRead;
    private Instant createdAt;
    private Instant resolvedAt;
}
