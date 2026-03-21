package com.agroanalytics.auth.controller;

import com.agroanalytics.auth.dto.ChangePasswordRequest;
import com.agroanalytics.auth.dto.ForgotPasswordRequest;
import com.agroanalytics.auth.dto.LoginRequest;
import com.agroanalytics.auth.dto.LoginResponse;
import com.agroanalytics.auth.dto.LoginChallengeResponse;
import com.agroanalytics.auth.dto.RefreshTokenRequest;
import com.agroanalytics.auth.dto.ResendEmailCodeRequest;
import com.agroanalytics.auth.dto.ResendLoginCodeRequest;
import com.agroanalytics.auth.dto.RegisterRequest;
import com.agroanalytics.auth.dto.ResetPasswordRequest;
import com.agroanalytics.auth.dto.VerifyEmailCodeRequest;
import com.agroanalytics.auth.dto.VerifyLoginCodeRequest;
import com.agroanalytics.auth.model.User;
import com.agroanalytics.auth.service.AuthService;
import com.agroanalytics.auth.service.RegistrationRateLimiter;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.web.bind.annotation.*;
import jakarta.servlet.http.HttpServletRequest;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import io.swagger.v3.oas.annotations.responses.ApiResponse;

import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
@Tag(name = "Auth", description = "Аутентификация и регистрация")
public class AuthController {

    private final AuthService authService;
    private final RegistrationRateLimiter registrationRateLimiter;

    @Operation(summary = "Вход", description = "Авторизация по логину и паролю")
    @ApiResponse(responseCode = "200", description = "Успешный вход")
    @PostMapping("/login")
    public ResponseEntity<LoginChallengeResponse> login(@Valid @RequestBody LoginRequest request) {
        LoginChallengeResponse response = authService.login(request);
        return ResponseEntity.ok(response);
    }

    @Operation(summary = "Подтверждение кода входа", description = "Проверка 6-значного кода из email и выдача JWT")
    @PostMapping("/login/verify-code")
    public ResponseEntity<LoginResponse> verifyLoginCode(@Valid @RequestBody VerifyLoginCodeRequest request) {
        LoginResponse response = authService.verifyLoginCode(request);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/login/resend-code")
    public ResponseEntity<LoginChallengeResponse> resendLoginCode(@Valid @RequestBody ResendLoginCodeRequest request) {
        LoginChallengeResponse response = authService.resendLoginCode(request.getRequestId());
        return ResponseEntity.ok(response);
    }

    @Operation(summary = "Регистрация", description = "Регистрация нового пользователя")
    @ApiResponse(responseCode = "201", description = "Учётная запись создана, требуется подтверждение email")
    @PostMapping("/register")
    public ResponseEntity<Map<String, Object>> register(
            @Valid @RequestBody RegisterRequest request,
            HttpServletRequest httpRequest
    ) {
        registrationRateLimiter.checkLimit(clientIp(httpRequest));
        long expiresInSeconds = authService.register(request);
        return ResponseEntity.status(201).body(Map.of(
                "message", "Регистрация успешна. На почту отправлен код подтверждения (6 цифр) и ссылка.",
                "expiresInSeconds", expiresInSeconds,
                "emailConfigured", authService.isMailConfigured()
        ));
    }

    @Operation(summary = "Подтверждение email", description = "Подтверждение email по токену из письма")
    @GetMapping("/verify-email")
    public ResponseEntity<Map<String, String>> verifyEmail(@RequestParam("token") String token) {
        authService.verifyEmail(token);
        return ResponseEntity.ok(Map.of("message", "Email verified successfully"));
    }

    @Operation(summary = "Подтверждение email по коду", description = "Ввод 6-значного кода из письма")
    @PostMapping("/verify-email-code")
    public ResponseEntity<Map<String, String>> verifyEmailByCode(@Valid @RequestBody VerifyEmailCodeRequest request) {
        authService.verifyEmailByCode(request.getEmail(), request.getCode());
        return ResponseEntity.ok(Map.of("message", "Email verified successfully"));
    }

    @PostMapping("/verify-email-code/resend")
    public ResponseEntity<Map<String, Object>> resendEmailCode(@Valid @RequestBody ResendEmailCodeRequest request) {
        long expiresInSeconds = authService.resendEmailVerificationCode(request.getEmail());
        return ResponseEntity.ok(Map.of(
                "message", "Новый код подтверждения отправлен на email",
                "expiresInSeconds", expiresInSeconds
        ));
    }

    @PostMapping("/logout")
    public ResponseEntity<Map<String, String>> logout(
            @RequestHeader(value = "Authorization", required = false) String authHeader) {
        // Stateless JWT - client is responsible for discarding the token
        return ResponseEntity.ok(Map.of("message", "Logged out successfully"));
    }

    @Operation(summary = "Обновление токена", description = "Получение новой пары access/refresh по refresh token")
    @PostMapping("/refresh")
    public ResponseEntity<LoginResponse> refresh(@Valid @RequestBody RefreshTokenRequest request) {
        LoginResponse response = authService.refresh(request);
        return ResponseEntity.ok(response);
    }

    @Operation(summary = "Текущий пользователь", description = "Информация о пользователе по JWT")
    @GetMapping("/me")
    public ResponseEntity<?> me(
            @RequestHeader(value = "Authorization", required = false) String authHeader) {
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            return ResponseEntity.status(401).body(Map.of("error", "No token provided"));
        }

        String token = authHeader.substring(7);
        Optional<User> userOpt = authService.getUserFromToken(token);

        if (userOpt.isEmpty()) {
            return ResponseEntity.status(401).body(Map.of("error", "Invalid or expired token"));
        }

        User user = userOpt.get();
        LoginResponse.UserInfo userInfo = LoginResponse.UserInfo.builder()
                .id(user.getId())
                .username(user.getUsername())
                .email(user.getEmail())
                .fullName(user.getFullName())
                .role(user.getRole())
                .build();

        return ResponseEntity.ok(userInfo);
    }

    @Operation(summary = "Запрос сброса пароля", description = "Отправляет письмо со ссылкой для сброса пароля")
    @PostMapping("/forgot-password")
    public ResponseEntity<Map<String, Object>> forgotPassword(@Valid @RequestBody ForgotPasswordRequest request) {
        authService.requestPasswordReset(request);
        // Always return 200 to avoid email enumeration
        return ResponseEntity.ok(Map.of(
                "message", "Если указанный email зарегистрирован, на него отправлена ссылка для сброса пароля.",
                "emailConfigured", authService.isMailConfigured()
        ));
    }

    @Operation(summary = "Сброс пароля", description = "Устанавливает новый пароль по токену из письма")
    @PostMapping("/reset-password")
    public ResponseEntity<Map<String, String>> resetPassword(@Valid @RequestBody ResetPasswordRequest request) {
        authService.resetPassword(request);
        return ResponseEntity.ok(Map.of("message", "Пароль успешно изменён. Войдите с новым паролем."));
    }

    @Operation(summary = "Смена пароля", description = "Смена пароля для авторизованного пользователя")
    @PostMapping("/change-password")
    public ResponseEntity<Map<String, String>> changePassword(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @Valid @RequestBody ChangePasswordRequest request
    ) {
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            return ResponseEntity.status(401).body(Map.of("error", "No token provided"));
        }
        String token = authHeader.substring(7);
        Optional<com.agroanalytics.auth.model.User> userOpt = authService.getUserFromToken(token);
        if (userOpt.isEmpty()) {
            return ResponseEntity.status(401).body(Map.of("error", "Invalid or expired token"));
        }
        authService.changePassword(userOpt.get().getUsername(), request);
        return ResponseEntity.ok(Map.of("message", "Пароль успешно изменён."));
    }

    @ExceptionHandler(BadCredentialsException.class)
    public ResponseEntity<Map<String, String>> handleBadCredentials(BadCredentialsException ex) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of(
                "message", "Неверный логин или пароль",
                "error", "Invalid username or password"));
    }

    /** За nginx/gateway все запросы не должны упираться в один remoteAddr контейнера. */
    private static String clientIp(HttpServletRequest req) {
        String xff = req.getHeader("X-Forwarded-For");
        if (xff != null && !xff.isBlank()) {
            return xff.split(",")[0].trim();
        }
        String ra = req.getRemoteAddr();
        return ra == null || ra.isBlank() ? "unknown" : ra;
    }
}
