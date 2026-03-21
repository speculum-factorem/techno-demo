package com.agroanalytics.auth.controller;

import com.agroanalytics.auth.dto.LoginRequest;
import com.agroanalytics.auth.dto.LoginResponse;
import com.agroanalytics.auth.dto.RefreshTokenRequest;
import com.agroanalytics.auth.dto.RegisterRequest;
import com.agroanalytics.auth.dto.VerifyEmailCodeRequest;
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
    public ResponseEntity<LoginResponse> login(@Valid @RequestBody LoginRequest request) {
        LoginResponse response = authService.login(request);
        return ResponseEntity.ok(response);
    }

    @Operation(summary = "Регистрация", description = "Регистрация нового пользователя")
    @ApiResponse(responseCode = "201", description = "Учётная запись создана, требуется подтверждение email")
    @PostMapping("/register")
    public ResponseEntity<Map<String, String>> register(
            @Valid @RequestBody RegisterRequest request,
            HttpServletRequest httpRequest
    ) {
        String clientKey = httpRequest.getRemoteAddr();
        registrationRateLimiter.checkLimit(clientKey == null ? "unknown" : clientKey);
        authService.register(request);
        return ResponseEntity.status(201).body(Map.of(
                "message", "Регистрация успешна. На почту отправлен код подтверждения (6 цифр) и ссылка."
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
        authService.verifyEmailByCode(request.getCode());
        return ResponseEntity.ok(Map.of("message", "Email verified successfully"));
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

    @ExceptionHandler(BadCredentialsException.class)
    public ResponseEntity<Map<String, String>> handleBadCredentials(BadCredentialsException ex) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Invalid username or password"));
    }
}
