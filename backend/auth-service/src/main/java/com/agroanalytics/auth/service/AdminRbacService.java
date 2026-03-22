package com.agroanalytics.auth.service;

import com.agroanalytics.auth.dto.RbacUserResponse;
import com.agroanalytics.auth.model.User;
import com.agroanalytics.auth.repository.UserRepository;
import com.agroanalytics.auth.util.AppRoleMapping;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.Collections;
import java.util.List;
import java.util.Objects;

@Service
@RequiredArgsConstructor
public class AdminRbacService {

    private final UserRepository userRepository;

    public User requireAdminByUsername(String username) {
        if (username == null || username.isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Не указан пользователь");
        }
        User u = userRepository.findByUsername(username.trim())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
        if (u.getRole() != User.Role.ADMIN) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Доступ только у администратора");
        }
        if (!u.isActive()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Учётная запись заблокирована");
        }
        return u;
    }

    public List<RbacUserResponse> listUsers(User admin) {
        List<User> list;
        if (admin.getOrganizationId() == null) {
            list = userRepository.findAll();
        } else {
            list = userRepository.findByOrganizationIdOrderByUsernameAsc(admin.getOrganizationId());
        }
        return list.stream().map(this::toDto).toList();
    }

    @Transactional
    public RbacUserResponse updateRole(User admin, Long targetId, String appRole) {
        User target = userRepository.findById(targetId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Пользователь не найден"));
        assertSameScope(admin, target);

        User.Role newRole = AppRoleMapping.toUserRole(appRole.trim());
        if (admin.getOrganizationId() != null && newRole == User.Role.ADMIN && "super_admin".equalsIgnoreCase(appRole.trim())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Назначение super_admin доступно только платформенному администратору");
        }
        target.setRole(newRole);
        userRepository.save(target);
        return toDto(target);
    }

    @Transactional
    public RbacUserResponse updateActive(User admin, Long targetId, boolean active) {
        User target = userRepository.findById(targetId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Пользователь не найден"));
        assertSameScope(admin, target);
        if (Objects.equals(admin.getId(), target.getId()) && !active) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Нельзя заблокировать свою учётную запись");
        }
        target.setActive(active);
        userRepository.save(target);
        return toDto(target);
    }

    private void assertSameScope(User admin, User target) {
        if (admin.getOrganizationId() == null) {
            return;
        }
        if (!Objects.equals(admin.getOrganizationId(), target.getOrganizationId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Пользователь вне вашей организации");
        }
    }

    private RbacUserResponse toDto(User u) {
        String orgName = u.getOrganizationId() == null
                ? "Платформа"
                : "Организация #" + u.getOrganizationId();
        String lastLogin = u.getCreatedAt() != null ? u.getCreatedAt().toString() : "";
        return RbacUserResponse.builder()
                .id(String.valueOf(u.getId()))
                .username(u.getUsername())
                .fullName(u.getFullName() != null ? u.getFullName() : u.getUsername())
                .email(u.getEmail())
                .appRole(toAppRole(u))
                .organizationId(u.getOrganizationId() != null ? String.valueOf(u.getOrganizationId()) : "")
                .organizationName(orgName)
                .farmIds(Collections.emptyList())
                .fieldIds(Collections.emptyList())
                .lastLogin(lastLogin)
                .createdAt(u.getCreatedAt() != null ? u.getCreatedAt().toString() : "")
                .active(u.isActive())
                .build();
    }

    private String toAppRole(User u) {
        if (u.getRole() == User.Role.ADMIN) {
            return u.getOrganizationId() == null ? "super_admin" : "org_admin";
        }
        if (u.getRole() == User.Role.AGRONOMIST) {
            return "agronomist";
        }
        return "viewer";
    }
}
