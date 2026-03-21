package com.agroanalytics.auth.controller;

import com.agroanalytics.auth.config.RestExceptionHandler;
import com.agroanalytics.auth.dto.LoginRequest;
import com.agroanalytics.auth.dto.LoginChallengeResponse;
import com.agroanalytics.auth.dto.RegisterRequest;
import com.agroanalytics.auth.model.User;
import com.agroanalytics.auth.service.AuthService;
import com.agroanalytics.auth.service.RegistrationRateLimiter;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(controllers = AuthController.class)
@AutoConfigureMockMvc(addFilters = false)
@Import(RestExceptionHandler.class)
class AuthControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private AuthService authService;

    @MockBean
    private RegistrationRateLimiter registrationRateLimiter;

    @Test
    void login_success_returns200() throws Exception {
        LoginRequest request = new LoginRequest("admin", "admin");
        LoginChallengeResponse response = LoginChallengeResponse.builder()
                .requestId("request-123")
                .expiresInSeconds(600)
                .message("Код для входа отправлен на email")
                .build();

        when(authService.login(any(LoginRequest.class))).thenReturn(response);

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.requestId").value("request-123"));
    }

    @Test
    void login_badCredentials_returns401() throws Exception {
        LoginRequest request = new LoginRequest("wrong", "wrong");
        when(authService.login(any(LoginRequest.class)))
                .thenThrow(new BadCredentialsException("Invalid credentials"));

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void register_success_returns201() throws Exception {
        RegisterRequest request = new RegisterRequest();
        request.setUsername("newuser");
        request.setEmail("user@test.com");
        request.setFullName("Test User");
        request.setPassword("SecurePass1!");
        request.setConfirmPassword("SecurePass1!");
        request.setPersonalDataConsent(true);

        doNothing().when(registrationRateLimiter).checkLimit(any());
        when(authService.register(any(RegisterRequest.class))).thenReturn(86400L);

        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.message").exists());
    }

    @Test
    void verifyEmail_success_returns200() throws Exception {
        doNothing().when(authService).verifyEmail("valid-token");

        mockMvc.perform(get("/api/auth/verify-email").param("token", "valid-token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Email verified successfully"));
    }

    @Test
    void me_validToken_returnsUser() throws Exception {
        User user = User.builder()
                .id(1L)
                .username("admin")
                .email("admin@test.com")
                .fullName("Admin")
                .role(User.Role.ADMIN)
                .build();
        when(authService.getUserFromToken("valid-token")).thenReturn(Optional.of(user));

        mockMvc.perform(get("/api/auth/me")
                        .header("Authorization", "Bearer valid-token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value("admin"))
                .andExpect(jsonPath("$.email").value("admin@test.com"));
    }

    @Test
    void me_noToken_returns401() throws Exception {
        mockMvc.perform(get("/api/auth/me"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void verifyEmailByCode_success_returns200() throws Exception {
        doNothing().when(authService).verifyEmailByCode("user@test.com", "123456");

        mockMvc.perform(post("/api/auth/verify-email-code")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"user@test.com\",\"code\":\"123456\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Email verified successfully"));
    }
}
