package com.agroanalytics.auth.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "organization_invite_codes")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class OrganizationInviteCode {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 100)
    private String code;

    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    @Column(name = "expires_at")
    private LocalDateTime expiresAt;

    @Column(name = "used_at")
    private LocalDateTime usedAt;

    /**
     * Если true — после успешной регистрации код помечается использованным (индивидуальные приглашения).
     * Демо-код организации обычно с false + глобальный {@code invite-single-use:false}.
     */
    @Column(name = "consumable_once", nullable = false)
    @Builder.Default
    private boolean consumableOnce = false;

    /** Роль в UI (agronomist, viewer, …), назначаемая при регистрации по этому коду. */
    @Column(name = "default_app_role", length = 32)
    private String defaultAppRole;

    /** Если задан — регистрация только с этим email (без учёта регистра). */
    @Column(name = "invited_email", length = 255)
    private String invitedEmail;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
}
