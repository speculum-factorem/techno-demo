package com.agroanalytics.auth.controller;

import com.agroanalytics.auth.dto.CreateInviteRequest;
import com.agroanalytics.auth.dto.InviteCodeResponse;
import com.agroanalytics.auth.dto.RbacUserResponse;
import com.agroanalytics.auth.dto.UpdateRbacUserActiveRequest;
import com.agroanalytics.auth.dto.UpdateRbacUserRoleRequest;
import com.agroanalytics.auth.model.User;
import com.agroanalytics.auth.service.AdminInviteService;
import com.agroanalytics.auth.service.AdminRbacService;
import com.agroanalytics.auth.service.AuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

/**
 * RBAC: список пользователей и смена роли / блокировка. Требует JWT (через gateway: X-User-Id).
 * Доступ только для {@link User.Role#ADMIN}.
 */
@RestController
@RequestMapping("/api/auth/admin")
@RequiredArgsConstructor
public class AdminUserController {

    private final AdminRbacService adminRbacService;
    private final AdminInviteService adminInviteService;
    private final AuthService authService;

    @GetMapping("/users")
    public List<RbacUserResponse> listUsers(
            @RequestHeader(value = "X-User-Id", required = false) String xUserId,
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        User admin = adminRbacService.requireAdminByUsername(resolveUsername(xUserId, authorization));
        return adminRbacService.listUsers(admin);
    }

    @PatchMapping("/users/{id}/role")
    public RbacUserResponse updateRole(
            @PathVariable("id") Long id,
            @Valid @RequestBody UpdateRbacUserRoleRequest body,
            @RequestHeader(value = "X-User-Id", required = false) String xUserId,
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        User admin = adminRbacService.requireAdminByUsername(resolveUsername(xUserId, authorization));
        return adminRbacService.updateRole(admin, id, body.getAppRole());
    }

    @PatchMapping("/users/{id}/active")
    public RbacUserResponse updateActive(
            @PathVariable("id") Long id,
            @Valid @RequestBody UpdateRbacUserActiveRequest body,
            @RequestHeader(value = "X-User-Id", required = false) String xUserId,
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        User admin = adminRbacService.requireAdminByUsername(resolveUsername(xUserId, authorization));
        return adminRbacService.updateActive(admin, id, body.isActive());
    }

    @PostMapping("/invites")
    public InviteCodeResponse createInvite(
            @Valid @RequestBody CreateInviteRequest body,
            @RequestHeader(value = "X-User-Id", required = false) String xUserId,
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        User admin = adminRbacService.requireAdminByUsername(resolveUsername(xUserId, authorization));
        return adminInviteService.createInvite(admin, body);
    }

    @GetMapping("/invites")
    public List<InviteCodeResponse> listInvites(
            @RequestParam(value = "organizationId", required = false) Long organizationId,
            @RequestHeader(value = "X-User-Id", required = false) String xUserId,
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        User admin = adminRbacService.requireAdminByUsername(resolveUsername(xUserId, authorization));
        return adminInviteService.listInvites(admin, organizationId);
    }

    @DeleteMapping("/invites/{code}")
    public void revokeInvite(
            @PathVariable("code") String code,
            @RequestHeader(value = "X-User-Id", required = false) String xUserId,
            @RequestHeader(value = "Authorization", required = false) String authorization
    ) {
        User admin = adminRbacService.requireAdminByUsername(resolveUsername(xUserId, authorization));
        adminInviteService.revokeInvite(admin, code);
    }

    private String resolveUsername(String xUserId, String authorization) {
        if (xUserId != null && !xUserId.isBlank()) {
            return xUserId.trim();
        }
        if (authorization != null && authorization.startsWith("Bearer ")) {
            return authService.getUserFromToken(authorization.substring(7))
                    .map(User::getUsername)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
        }
        throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Требуется авторизация");
    }
}
