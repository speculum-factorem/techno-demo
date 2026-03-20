package com.agroanalytics.field.security;

/**
 * Resolved from gateway headers (JWT) or trusted internal service token.
 */
public record RequestActor(Long organizationId, String role, boolean internalService) {

    public static RequestActor fromHeaders(
            String orgIdHeader,
            String roleHeader,
            String internalToken,
            String configuredInternalToken
    ) {
        if (configuredInternalToken != null && !configuredInternalToken.isBlank()
                && configuredInternalToken.equals(internalToken)) {
            return new RequestActor(null, "ADMIN", true);
        }

        Long orgId = parseOrg(orgIdHeader);
        String role = roleHeader != null ? roleHeader.trim() : "";
        return new RequestActor(orgId, role, false);
    }

    private static Long parseOrg(String s) {
        if (s == null || s.isBlank()) {
            return null;
        }
        try {
            return Long.parseLong(s.trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    public boolean isAdmin() {
        return internalService || (role != null && "ADMIN".equalsIgnoreCase(role));
    }
}
