package com.agroanalytics.auth.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class InviteCodeResponse {
    private String code;
    private String registerUrl;
    private Long organizationId;
    private String defaultAppRole;
    private String invitedEmail;
    private String expiresAt;
    private String createdAt;
    private String usedAt;
    private boolean consumableOnce;
    private boolean emailSent;
}
