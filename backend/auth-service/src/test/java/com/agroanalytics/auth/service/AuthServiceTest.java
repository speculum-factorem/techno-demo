package com.agroanalytics.auth.service;

import com.agroanalytics.auth.dto.LoginRequest;
import com.agroanalytics.auth.dto.LoginResponse;
import com.agroanalytics.auth.dto.RegisterRequest;
import com.agroanalytics.auth.model.User;
import com.agroanalytics.auth.repository.OrganizationInviteCodeRepository;
import com.agroanalytics.auth.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private JwtService jwtService;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private VerificationEmailService verificationEmailService;

    @Mock
    private com.agroanalytics.auth.repository.EmailVerificationTokenRepository emailVerificationTokenRepository;

    @Mock
    private OrganizationInviteCodeRepository organizationInviteCodeRepository;

    @InjectMocks
    private AuthService authService;

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(authService, "bootstrapDefaultUsers", false);
    }

    @Test
    void login_validCredentials_returnsTokens() {
        User user = User.builder()
                .id(1L)
                .username("admin")
                .email("admin@test.com")
                .passwordHash("$2a$10$hashed")
                .role(User.Role.ADMIN)
                .emailVerified(true)
                .build();
        when(userRepository.findByUsername("admin")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("admin", user.getPasswordHash())).thenReturn(true);
        when(jwtService.generateToken(anyString(), any())).thenReturn("access-token");
        when(jwtService.generateRefreshToken(anyString())).thenReturn("refresh-token");
        when(jwtService.getExpiration()).thenReturn(86400L);

        LoginRequest request = new LoginRequest("admin", "admin");
        LoginResponse response = authService.login(request);

        assertThat(response.getAccessToken()).isEqualTo("access-token");
        assertThat(response.getRefreshToken()).isEqualTo("refresh-token");
    }

    @Test
    void login_wrongPassword_throwsBadCredentials() {
        User user = User.builder()
                .username("admin")
                .passwordHash("$2a$10$hashed")
                .emailVerified(true)
                .build();
        when(userRepository.findByUsername("admin")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("wrong", user.getPasswordHash())).thenReturn(false);

        assertThatThrownBy(() -> authService.login(new LoginRequest("admin", "wrong")))
                .isInstanceOf(BadCredentialsException.class);
    }

    @Test
    void login_userNotFound_throwsBadCredentials() {
        when(userRepository.findByUsername("unknown")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> authService.login(new LoginRequest("unknown", "pass")))
                .isInstanceOf(BadCredentialsException.class);
    }
}
