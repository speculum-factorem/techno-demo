package com.agroanalytics.gateway.filter;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.http.server.reactive.ServerHttpResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;

@Component
public class JwtAuthFilter implements GlobalFilter, Ordered {

    private static final Logger logger = LoggerFactory.getLogger(JwtAuthFilter.class);

    private static final String BEARER_PREFIX = "Bearer ";
    @Value("${jwt.secret}")
    private String jwtSecret;

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        ServerHttpRequest request = exchange.getRequest();
        String path = request.getURI().getPath();

        // Skip authentication for public paths
        if (isPublicAuthPath(path)) {
            logger.debug("Skipping JWT validation for public path: {}", path);
            return chain.filter(exchange);
        }

        // Extract Authorization header
        String authHeader = request.getHeaders().getFirst(HttpHeaders.AUTHORIZATION);

        if (authHeader == null || !authHeader.startsWith(BEARER_PREFIX)) {
            logger.warn("Missing or invalid Authorization header for path: {}", path);
            return unauthorized(exchange);
        }

        String token = authHeader.substring(BEARER_PREFIX.length());

        try {
            Claims claims = parseToken(token);

            String userId = claims.getSubject();
            String role = claims.get("role", String.class);
            String organizationIdHeader = extractOrganizationIdClaim(claims);

            if (userId == null || userId.isBlank()) {
                logger.warn("JWT token has no subject for path: {}", path);
                return unauthorized(exchange);
            }

            // Mutate the request to add userId, role, and tenant for downstream services
            ServerHttpRequest mutatedRequest = request.mutate()
                    .header("X-User-Id", userId)
                    .header("X-User-Role", role != null ? role : "")
                    .header("X-Organization-Id", organizationIdHeader)
                    .build();

            logger.debug("JWT validated successfully. UserId={}, Role={}, OrgId={}, Path={}",
                    userId, role, organizationIdHeader, path);

            return chain.filter(exchange.mutate().request(mutatedRequest).build());

        } catch (JwtException e) {
            logger.warn("Invalid JWT token for path {}: {}", path, e.getMessage());
            return unauthorized(exchange);
        } catch (Exception e) {
            logger.error("Unexpected error validating JWT for path {}: {}", path, e.getMessage(), e);
            return unauthorized(exchange);
        }
    }

    /**
     * Только публичные эндпоинты auth. Остальные /api/auth/* (me, change-password, admin/*) требуют JWT.
     * Остальные сервисы (/api/fields, …) тоже требуют JWT.
     */
    private boolean isPublicAuthPath(String path) {
        if (!path.startsWith("/api/auth/")) {
            return false;
        }
        if (path.startsWith("/api/auth/admin")) {
            return false;
        }
        if (path.equals("/api/auth/me") || path.equals("/api/auth/change-password")) {
            return false;
        }
        return true;
    }

    private Claims parseToken(String token) {
        SecretKey key = Keys.hmacShaKeyFor(jwtSecret.getBytes(StandardCharsets.UTF_8));
        return Jwts.parser()
                .verifyWith(key)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    /**
     * JWT claim may deserialize as Integer, Long, or String depending on serializer.
     */
    private static String extractOrganizationIdClaim(Claims claims) {
        Object raw = claims.get("organizationId");
        if (raw == null) {
            return "";
        }
        if (raw instanceof Number n) {
            return String.valueOf(n.longValue());
        }
        return raw.toString();
    }

    private Mono<Void> unauthorized(ServerWebExchange exchange) {
        ServerHttpResponse response = exchange.getResponse();
        response.setStatusCode(HttpStatus.UNAUTHORIZED);
        response.getHeaders().add(HttpHeaders.CONTENT_TYPE, "application/json");
        var body = response.bufferFactory()
                .wrap("{\"error\":\"Unauthorized\",\"message\":\"Missing or invalid JWT token\"}".getBytes(StandardCharsets.UTF_8));
        return response.writeWith(Mono.just(body));
    }

    @Override
    public int getOrder() {
        // Run before routing filters
        return -100;
    }
}
