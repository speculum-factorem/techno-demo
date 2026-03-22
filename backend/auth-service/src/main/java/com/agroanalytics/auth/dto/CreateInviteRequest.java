package com.agroanalytics.auth.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class CreateInviteRequest {
    /**
     * Если указан — письмо со ссылкой и регистрация только с этим email.
     */
    private String email;

    @NotBlank(message = "Укажите роль")
    private String appRole;

    @Min(value = 1, message = "Срок от 1 дня")
    @Max(value = 365, message = "Срок не более 365 дней")
    private Integer expiresInDays = 14;

    /**
     * Обязателен для платформенного администратора (без organizationId).
     */
    private Long organizationId;
}
