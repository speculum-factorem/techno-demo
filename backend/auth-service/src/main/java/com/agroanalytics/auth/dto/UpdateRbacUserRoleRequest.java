package com.agroanalytics.auth.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class UpdateRbacUserRoleRequest {
    /**
     * super_admin, org_admin, agronomist, viewer, operator (operator сохраняется как OBSERVER)
     */
    @NotBlank
    private String appRole;
}
