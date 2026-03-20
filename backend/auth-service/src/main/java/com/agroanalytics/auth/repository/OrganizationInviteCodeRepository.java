package com.agroanalytics.auth.repository;

import com.agroanalytics.auth.model.OrganizationInviteCode;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface OrganizationInviteCodeRepository extends JpaRepository<OrganizationInviteCode, Long> {
    Optional<OrganizationInviteCode> findByCode(String code);
}
