package com.agroanalytics.auth.service;

import com.agroanalytics.auth.dto.CreateInviteRequest;
import com.agroanalytics.auth.dto.InviteCodeResponse;
import com.agroanalytics.auth.model.OrganizationInviteCode;
import com.agroanalytics.auth.model.User;
import com.agroanalytics.auth.repository.OrganizationInviteCodeRepository;
import com.agroanalytics.auth.util.AppRoleMapping;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AdminInviteService {

    private final OrganizationInviteCodeRepository organizationInviteCodeRepository;
    private final VerificationEmailService verificationEmailService;

    @Value("${app.frontend-url:http://localhost:3000}")
    private String frontendUrl;

    @Transactional
    public InviteCodeResponse createInvite(User admin, CreateInviteRequest req) {
        Long targetOrgId = resolveTargetOrganizationId(admin, req);

        String role = req.getAppRole() == null ? "" : req.getAppRole().trim();
        if (role.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Укажите роль");
        }
        if ("super_admin".equalsIgnoreCase(role)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Роль super_admin нельзя назначить через приглашение");
        }
        AppRoleMapping.toUserRole(role);

        int days = req.getExpiresInDays() != null ? req.getExpiresInDays() : 14;
        if (days < 1 || days > 365) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Срок действия от 1 до 365 дней");
        }

        String invitedEmail = normalizeEmail(req.getEmail());
        String code = generateUniqueInviteCode();
        LocalDateTime expiresAt = LocalDateTime.now().plusDays(days);

        OrganizationInviteCode entity = OrganizationInviteCode.builder()
                .code(code)
                .organizationId(targetOrgId)
                .expiresAt(expiresAt)
                .consumableOnce(true)
                .defaultAppRole(role.toLowerCase())
                .invitedEmail(invitedEmail)
                .build();
        organizationInviteCodeRepository.save(entity);

        boolean emailSent = false;
        if (invitedEmail != null) {
            emailSent = verificationEmailService.sendOrganizationInviteEmail(
                    invitedEmail, code, targetOrgId, roleLabelRu(role));
        }

        return toResponse(entity, emailSent);
    }

    public List<InviteCodeResponse> listInvites(User admin, Long organizationIdFilter) {
        List<OrganizationInviteCode> rows;
        if (admin.getOrganizationId() != null) {
            rows = organizationInviteCodeRepository.findByOrganizationIdOrderByCreatedAtDesc(admin.getOrganizationId());
        } else if (organizationIdFilter != null) {
            rows = organizationInviteCodeRepository.findByOrganizationIdOrderByCreatedAtDesc(organizationIdFilter);
        } else {
            rows = organizationInviteCodeRepository.findAllByOrderByCreatedAtDesc();
        }
        return rows.stream().map(r -> toResponse(r, false)).toList();
    }

    @Transactional
    public void revokeInvite(User admin, String code) {
        if (code == null || code.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Укажите код");
        }
        OrganizationInviteCode invite = organizationInviteCodeRepository.findByCode(code.trim())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Приглашение не найдено"));
        assertSameScope(admin, invite.getOrganizationId());
        organizationInviteCodeRepository.delete(invite);
    }

    private Long resolveTargetOrganizationId(User admin, CreateInviteRequest req) {
        if (admin.getOrganizationId() != null) {
            if (req.getOrganizationId() != null && !Objects.equals(req.getOrganizationId(), admin.getOrganizationId())) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Нельзя создать приглашение для другой организации");
            }
            return admin.getOrganizationId();
        }
        if (req.getOrganizationId() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Укажите organizationId организации");
        }
        return req.getOrganizationId();
    }

    private void assertSameScope(User admin, Long inviteOrganizationId) {
        if (admin.getOrganizationId() == null) {
            return;
        }
        if (!Objects.equals(admin.getOrganizationId(), inviteOrganizationId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Приглашение вне вашей организации");
        }
    }

    private String generateUniqueInviteCode() {
        for (int attempt = 0; attempt < 24; attempt++) {
            String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 16).toUpperCase();
            String code = "INV-" + suffix;
            if (organizationInviteCodeRepository.findByCode(code).isEmpty()) {
                return code;
            }
        }
        throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Не удалось сгенерировать код приглашения");
    }

    private static String normalizeEmail(String email) {
        if (email == null) {
            return null;
        }
        String t = email.trim();
        if (t.isEmpty()) {
            return null;
        }
        if (!t.matches("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Некорректный email");
        }
        return t.toLowerCase();
    }

    private static String roleLabelRu(String appRole) {
        if (appRole == null) {
            return "Участник";
        }
        return switch (appRole.trim().toLowerCase()) {
            case "org_admin" -> "Администратор организации";
            case "agronomist" -> "Агроном";
            case "operator" -> "Механизатор";
            case "viewer" -> "Наблюдатель";
            default -> appRole;
        };
    }

    private InviteCodeResponse toResponse(OrganizationInviteCode r, boolean emailSent) {
        String enc = URLEncoder.encode(r.getCode(), StandardCharsets.UTF_8);
        String registerUrl = frontendUrl.replaceAll("/$", "") + "/auth/register?invite=" + enc;
        return InviteCodeResponse.builder()
                .code(r.getCode())
                .registerUrl(registerUrl)
                .organizationId(r.getOrganizationId())
                .defaultAppRole(r.getDefaultAppRole())
                .invitedEmail(r.getInvitedEmail())
                .expiresAt(r.getExpiresAt() != null ? r.getExpiresAt().toString() : null)
                .createdAt(r.getCreatedAt() != null ? r.getCreatedAt().toString() : null)
                .usedAt(r.getUsedAt() != null ? r.getUsedAt().toString() : null)
                .consumableOnce(r.isConsumableOnce())
                .emailSent(emailSent)
                .build();
    }
}
