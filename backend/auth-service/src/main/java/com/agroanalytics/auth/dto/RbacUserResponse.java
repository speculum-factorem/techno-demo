package com.agroanalytics.auth.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Пользователь для экрана RBAC (роли super_admin / org_admin / agronomist / viewer).
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RbacUserResponse {
    private String id;
    private String username;
    private String fullName;
    private String email;
    /** Роль для UI: super_admin, org_admin, agronomist, viewer */
    private String appRole;
    private String organizationId;
    private String organizationName;
    private List<String> farmIds;
    private List<String> fieldIds;
    private String lastLogin;
    private String createdAt;
    private boolean active;
}
