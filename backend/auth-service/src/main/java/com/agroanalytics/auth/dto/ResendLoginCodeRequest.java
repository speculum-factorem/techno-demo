package com.agroanalytics.auth.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ResendLoginCodeRequest {
    @NotBlank(message = "Request ID is required")
    private String requestId;
}
