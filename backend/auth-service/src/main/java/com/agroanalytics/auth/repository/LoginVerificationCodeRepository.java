package com.agroanalytics.auth.repository;

import com.agroanalytics.auth.model.LoginVerificationCode;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface LoginVerificationCodeRepository extends JpaRepository<LoginVerificationCode, Long> {
    Optional<LoginVerificationCode> findByRequestId(String requestId);

    Optional<LoginVerificationCode> findFirstByUserIdAndUsedAtIsNullOrderByCreatedAtDesc(Long userId);
}
