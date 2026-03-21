package com.agroanalytics.field.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

@Configuration
@EnableWebSecurity
public class SecurityConfig {
    @Value("${agro.cors.allowed-origins}")
    private String allowedOrigins;

    @Value("${agro.cors.allowed-origin-patterns:}")
    private String allowedOriginPatterns;

    @Value("${agro.security.internal-api-token:}")
    private String internalApiToken;

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                .csrf(AbstractHttpConfigurer::disable)
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .sessionManagement(session ->
                        session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .addFilterBefore(new GatewayOrInternalAuthFilter(internalApiToken),
                        UsernamePasswordAuthenticationFilter.class)
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/actuator/**", "/v3/api-docs/**",
                                "/swagger-ui/**", "/swagger-ui.html").permitAll()
                        .anyRequest().authenticated());

        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        List<String> origins = Arrays.stream(allowedOrigins.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .collect(Collectors.toList());
        List<String> patterns = Arrays.stream(allowedOriginPatterns.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .collect(Collectors.toList());

        if (origins.contains("*")) {
            throw new IllegalStateException("agro.cors.allowed-origins cannot contain '*'; use agro.cors.allowed-origin-patterns");
        }
        if (origins.isEmpty() && patterns.isEmpty()) {
            throw new IllegalStateException("agro.cors: set allowed-origins and/or allowed-origin-patterns");
        }

        CorsConfiguration configuration = new CorsConfiguration();
        if (!origins.isEmpty()) {
            configuration.setAllowedOrigins(origins);
        }
        for (String pattern : patterns) {
            configuration.addAllowedOriginPattern(pattern);
        }
        configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"));
        configuration.setAllowedHeaders(List.of("*"));
        configuration.setAllowCredentials(true);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }

    /**
     * Authenticates requests forwarded by api-gateway (X-User-Id и/или X-Organization-Id) или
     * внутренние вызовы по X-Internal-Token.
     */
    private static class GatewayOrInternalAuthFilter extends OncePerRequestFilter {
        private final String configuredToken;

        GatewayOrInternalAuthFilter(String configuredToken) {
            this.configuredToken = configuredToken;
        }

        @Override
        protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
                throws ServletException, IOException {
            String xInternal = req.getHeader("X-Internal-Token");
            String xOrgId = req.getHeader("X-Organization-Id");
            String xUserId = req.getHeader("X-User-Id");

            boolean isInternal = configuredToken != null && !configuredToken.isBlank()
                    && configuredToken.equals(xInternal);
            boolean isGatewayForwarded = (xOrgId != null && !xOrgId.isBlank())
                    || (xUserId != null && !xUserId.isBlank());

            if (isInternal || isGatewayForwarded) {
                String role = isInternal ? "INTERNAL" : "USER";
                var auth = new UsernamePasswordAuthenticationToken(
                        "gateway-user", null,
                        List.of(new SimpleGrantedAuthority("ROLE_" + role)));
                SecurityContextHolder.getContext().setAuthentication(auth);
            }
            chain.doFilter(req, res);
        }
    }
}
