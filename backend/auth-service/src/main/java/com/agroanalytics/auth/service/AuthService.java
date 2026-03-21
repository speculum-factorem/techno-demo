package com.agroanalytics.auth.service;

import com.agroanalytics.auth.dto.LoginRequest;
import com.agroanalytics.auth.dto.LoginResponse;
import com.agroanalytics.auth.dto.RefreshTokenRequest;
import com.agroanalytics.auth.dto.RegisterRequest;
import com.agroanalytics.auth.model.EmailVerificationToken;
import com.agroanalytics.auth.model.OrganizationInviteCode;
import com.agroanalytics.auth.model.User;
import com.agroanalytics.auth.repository.EmailVerificationTokenRepository;
import com.agroanalytics.auth.repository.OrganizationInviteCodeRepository;
import com.agroanalytics.auth.repository.UserRepository;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class AuthService {

    private final UserRepository userRepository;
    private final EmailVerificationTokenRepository emailVerificationTokenRepository;
    private final OrganizationInviteCodeRepository organizationInviteCodeRepository;
    private final JwtService jwtService;
    private final PasswordEncoder passwordEncoder;
    private final VerificationEmailService verificationEmailService;

    @Value("${app.auth.verification-ttl-minutes:1440}")
    private long verificationTtlMinutes;
    @Value("${app.bootstrap.default-users:false}")
    private boolean bootstrapDefaultUsers;

    @PostConstruct
    public void initDefaultUsers() {
        if (!bootstrapDefaultUsers) {
            log.info("Default users bootstrap disabled for current profile");
            return;
        }
        if (userRepository.findByUsername("admin").isEmpty()) {
            User admin = User.builder()
                    .username("admin")
                    .email("admin@agroanalytics.com")
                    .fullName("System Administrator")
                    .passwordHash(passwordEncoder.encode("admin"))
                    .role(User.Role.ADMIN)
                    .emailVerified(true)
                    .build();
            userRepository.save(admin);
            log.info("Default admin user created: username=admin, password=admin");
        }
        if (userRepository.findByUsername("agronomist").isEmpty()) {
            User agronomist = User.builder()
                    .username("agronomist")
                    .email("agronomist@agroanalytics.com")
                    .fullName("Агроном (демо)")
                    .passwordHash(passwordEncoder.encode("agronomist"))
                    .role(User.Role.AGRONOMIST)
                    .organizationId(1L)
                    .emailVerified(true)
                    .build();
            userRepository.save(agronomist);
            log.info("Default agronomist user: username=agronomist, password=agronomist, organizationId=1");
        }
        if (organizationInviteCodeRepository.findByCode("ORG1-INVITE-2026").isEmpty()) {
            OrganizationInviteCode inviteCode = OrganizationInviteCode.builder()
                    .code("ORG1-INVITE-2026")
                    .organizationId(1L)
                    .expiresAt(LocalDateTime.now().plusYears(1))
                    .build();
            organizationInviteCodeRepository.save(inviteCode);
            log.info("Default invite code created for org 1: ORG1-INVITE-2026");
        }
    }

    public LoginResponse login(LoginRequest request) {
        User user = userRepository.findByUsername(request.getUsername())
                .orElseThrow(() -> new BadCredentialsException("Invalid username or password"));

        if (!passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            throw new BadCredentialsException("Invalid username or password");
        }
        if (!user.isEmailVerified()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Email is not verified");
        }

        Map<String, Object> claims = new HashMap<>();
        claims.put("role", user.getRole().name());
        claims.put("email", user.getEmail());
        if (user.getOrganizationId() != null) {
            claims.put("organizationId", user.getOrganizationId());
        }

        String accessToken = jwtService.generateToken(user.getUsername(), claims);
        String refreshToken = jwtService.generateRefreshToken(user.getUsername());

        LoginResponse.UserInfo userInfo = LoginResponse.UserInfo.builder()
                .id(user.getId())
                .username(user.getUsername())
                .email(user.getEmail())
                .fullName(user.getFullName())
                .role(user.getRole())
                .build();

        return LoginResponse.builder()
                .accessToken(accessToken)
                .refreshToken(refreshToken)
                .expiresIn(jwtService.getExpiration())
                .user(userInfo)
                .build();
    }

    public void register(RegisterRequest request) {
        String normalizedUsername = request.getUsername().trim();
        String normalizedEmail = request.getEmail().trim().toLowerCase();
        String normalizedFullName = request.getFullName().trim();

        validatePasswordPolicy(request.getPassword());
        if (!request.getPassword().equals(request.getConfirmPassword())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Passwords do not match");
        }

        if (userRepository.findByUsername(normalizedUsername).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Username is already taken");
        }
        if (userRepository.findByEmail(normalizedEmail).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Email is already registered");
        }

        Long organizationId = validateAndResolveOrganization(request);

        User user = User.builder()
                .username(normalizedUsername)
                .email(normalizedEmail)
                .fullName(normalizedFullName)
                .passwordHash(passwordEncoder.encode(request.getPassword()))
                .role(User.Role.AGRONOMIST)
                .organizationId(organizationId)
                .emailVerified(false)
                .build();

        userRepository.save(user);
        createAndSendVerificationToken(user);
    }

    public void verifyEmail(String token) {
        EmailVerificationToken verificationToken = emailVerificationTokenRepository.findByToken(token)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid verification token"));
        completeVerification(verificationToken);
    }

    public void verifyEmailByCode(String code) {
        String normalized = code == null ? "" : code.trim();
        EmailVerificationToken verificationToken = emailVerificationTokenRepository.findByVerificationCode(normalized)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid verification code"));
        completeVerification(verificationToken);
    }

    private void completeVerification(EmailVerificationToken verificationToken) {
        if (verificationToken.getUsedAt() != null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Verification token is already used");
        }
        if (verificationToken.getExpiresAt().isBefore(LocalDateTime.now())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Verification token has expired");
        }

        User user = verificationToken.getUser();
        user.setEmailVerified(true);
        userRepository.save(user);
        verificationToken.setUsedAt(LocalDateTime.now());
        emailVerificationTokenRepository.save(verificationToken);
    }

    public LoginResponse refresh(RefreshTokenRequest request) {
        String refreshToken = request.getRefreshToken();
        String username;
        try {
            username = jwtService.extractUsername(refreshToken);
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid refresh token");
        }

        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found"));

        if (!jwtService.isTokenValid(refreshToken, username)) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Refresh token expired or invalid");
        }
        if (!user.isEmailVerified()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Email is not verified");
        }

        Map<String, Object> claims = new HashMap<>();
        claims.put("role", user.getRole().name());
        claims.put("email", user.getEmail());
        if (user.getOrganizationId() != null) {
            claims.put("organizationId", user.getOrganizationId());
        }

        String accessToken = jwtService.generateToken(username, claims);
        String nextRefreshToken = jwtService.generateRefreshToken(username);
        LoginResponse.UserInfo userInfo = LoginResponse.UserInfo.builder()
                .id(user.getId())
                .username(user.getUsername())
                .email(user.getEmail())
                .fullName(user.getFullName())
                .role(user.getRole())
                .build();

        return LoginResponse.builder()
                .accessToken(accessToken)
                .refreshToken(nextRefreshToken)
                .expiresIn(jwtService.getExpiration())
                .user(userInfo)
                .build();
    }

    public Optional<User> getUserFromToken(String token) {
        try {
            String username = jwtService.extractUsername(token);
            return userRepository.findByUsername(username);
        } catch (Exception e) {
            return Optional.empty();
        }
    }

    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    private void createAndSendVerificationToken(User user) {
        String token = UUID.randomUUID().toString() + UUID.randomUUID();
        String code = generateUniqueVerificationCode();
        EmailVerificationToken entity = EmailVerificationToken.builder()
                .token(token)
                .verificationCode(code)
                .user(user)
                .expiresAt(LocalDateTime.now().plusMinutes(verificationTtlMinutes))
                .build();
        emailVerificationTokenRepository.save(entity);
        verificationEmailService.sendVerificationEmail(user.getEmail(), token, code);
    }

    /** 6-digit numeric code, unique among existing rows */
    private String generateUniqueVerificationCode() {
        for (int attempt = 0; attempt < 20; attempt++) {
            int n = 100_000 + SECURE_RANDOM.nextInt(900_000);
            String code = String.valueOf(n);
            if (!emailVerificationTokenRepository.existsByVerificationCode(code)) {
                return code;
            }
        }
        throw new IllegalStateException("Could not generate unique verification code");
    }

    private void validatePasswordPolicy(String password) {
        boolean hasUpper = password.chars().anyMatch(Character::isUpperCase);
        boolean hasLower = password.chars().anyMatch(Character::isLowerCase);
        boolean hasDigit = password.chars().anyMatch(Character::isDigit);
        boolean hasSpecial = password.chars().anyMatch(c -> !Character.isLetterOrDigit(c));

        if (!(hasUpper && hasLower && hasDigit && hasSpecial)) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Password must contain uppercase, lowercase, digit, and special character"
            );
        }
    }

    private Long validateAndResolveOrganization(RegisterRequest request) {
        if (request.getOrganizationId() == null) {
            return null;
        }
        if (request.getInviteCode() == null || request.getInviteCode().isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Invite code is required when organizationId is provided"
            );
        }

        OrganizationInviteCode invite = organizationInviteCodeRepository.findByCode(request.getInviteCode().trim())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invite code is invalid"));

        if (invite.getUsedAt() != null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invite code is already used");
        }
        if (invite.getExpiresAt() != null && invite.getExpiresAt().isBefore(LocalDateTime.now())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invite code has expired");
        }
        if (!invite.getOrganizationId().equals(request.getOrganizationId())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invite code does not match organizationId");
        }

        invite.setUsedAt(LocalDateTime.now());
        organizationInviteCodeRepository.save(invite);
        return invite.getOrganizationId();
    }
}
