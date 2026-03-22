package com.agroanalytics.auth.util;

import com.agroanalytics.auth.model.User;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

/**
 * Согласованное сопоставление ролей UI (RBAC) с {@link User.Role}.
 */
public final class AppRoleMapping {

    private AppRoleMapping() {
    }

    public static User.Role toUserRole(String appRole) {
        if (appRole == null || appRole.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Роль не указана");
        }
        String r = appRole.trim().toLowerCase();
        return switch (r) {
            case "super_admin", "org_admin" -> User.Role.ADMIN;
            case "agronomist" -> User.Role.AGRONOMIST;
            case "viewer", "operator" -> User.Role.OBSERVER;
            default -> throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Неизвестная роль: " + appRole);
        };
    }

    /**
     * Роль по умолчанию при регистрации без явной роли в приглашении.
     */
    public static User.Role defaultRegistrationRole() {
        return User.Role.AGRONOMIST;
    }
}
