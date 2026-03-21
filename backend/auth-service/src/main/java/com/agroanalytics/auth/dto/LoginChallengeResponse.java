package com.agroanalytics.auth.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LoginChallengeResponse {
    private String requestId;
    private long expiresInSeconds;
    private String message;
}
