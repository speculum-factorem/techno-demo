package com.agroanalytics.auth.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class RegistrationRateLimiter {
    private final int maxRequests;
    private final long windowMillis;
    private final Map<String, Deque<Long>> attemptsByKey = new ConcurrentHashMap<>();

    public RegistrationRateLimiter(
            @Value("${app.auth.register-rate-limit.requests:5}") int maxRequests,
            @Value("${app.auth.register-rate-limit.window-seconds:900}") int windowSeconds
    ) {
        this.maxRequests = maxRequests;
        this.windowMillis = windowSeconds * 1000L;
    }

    public void checkLimit(String key) {
        long now = Instant.now().toEpochMilli();
        Deque<Long> attempts = attemptsByKey.computeIfAbsent(key, unused -> new ArrayDeque<>());

        synchronized (attempts) {
            while (!attempts.isEmpty() && now - attempts.peekFirst() > windowMillis) {
                attempts.pollFirst();
            }
            if (attempts.size() >= maxRequests) {
                throw new ResponseStatusException(
                        HttpStatus.TOO_MANY_REQUESTS,
                        "Too many registration attempts. Please try again later."
                );
            }
            attempts.addLast(now);
        }
    }
}
