package com.agroanalytics.auth.controller;

import com.agroanalytics.auth.dto.LoginRequest;
import com.agroanalytics.auth.dto.LoginResponse;
import com.agroanalytics.auth.dto.RefreshTokenRequest;
import com.agroanalytics.auth.dto.RegisterRequest;
import com.agroanalytics.auth.model.User;
import com.agroanalytics.auth.service.AuthService;
import com.agroanalytics.auth.service.RegistrationRateLimiter;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import jakarta.servlet.http.HttpServletRequest;

import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;
    private final RegistrationRateLimiter registrationRateLimiter;

    @PostMapping("/login")
    public ResponseEntity<LoginResponse> login(@Valid @RequestBody LoginRequest request) {
        LoginResponse response = authService.login(request);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/register")
    public ResponseEntity<Map<String, String>> register(
            @Valid @RequestBody RegisterRequest request,
            HttpServletRequest httpRequest
    ) {
        String clientKey = httpRequest.getRemoteAddr();
        registrationRateLimiter.checkLimit(clientKey == null ? "unknown" : clientKey);
        authService.register(request);
        return ResponseEntity.status(201).body(Map.of(
                "message", "Registration successful. Check your email to verify your account."
        ));
    }

    @GetMapping("/verify-email")
    public ResponseEntity<Map<String, String>> verifyEmail(@RequestParam("token") String token) {
        authService.verifyEmail(token);
        return ResponseEntity.ok(Map.of("message", "Email verified successfully"));
    }

    @PostMapping("/logout")
    public ResponseEntity<Map<String, String>> logout(
            @RequestHeader(value = "Authorization", required = false) String authHeader) {
        // Stateless JWT - client is responsible for discarding the token
        return ResponseEntity.ok(Map.of("message", "Logged out successfully"));
    }

    @PostMapping("/refresh")
    public ResponseEntity<LoginResponse> refresh(@Valid @RequestBody RefreshTokenRequest request) {
        LoginResponse response = authService.refresh(request);
        return ResponseEntity.ok(response);
    }

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
}
