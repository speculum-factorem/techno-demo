package com.agroanalytics.auth.dto;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class RegisterRequest {

    @NotBlank(message = "обязательное поле")
    @Size(min = 3, max = 50, message = "от 3 до 50 символов")
    @Pattern(regexp = "^[a-zA-Z0-9._-]{3,50}$", message = "только латиница, цифры и символы . _ -")
    private String username;

    @NotBlank(message = "обязательное поле")
    @Email(message = "некорректный адрес")
    private String email;

    @NotBlank(message = "обязательное поле")
    @Size(min = 2, max = 120, message = "от 2 до 120 символов")
    @Pattern(regexp = "^[\\p{L}\\p{M}0-9._'\\-\\s]{2,120}$", message = "допустимы буквы, пробел, дефис, точка, апостроф")
    private String fullName;

    @NotBlank(message = "обязательное поле")
    @Size(min = 8, max = 72, message = "от 8 до 72 символов")
    private String password;

    @NotBlank(message = "обязательное поле")
    private String confirmPassword;

    private Long organizationId;

    @Pattern(regexp = "^[a-zA-Z0-9\\-_.]{0,100}$", message = "недопустимые символы в коде")
    private String inviteCode;

    /** User consent to personal data processing (required for registration). */
    @AssertTrue(message = "необходимо согласие на обработку персональных данных")
    private boolean personalDataConsent;
}
