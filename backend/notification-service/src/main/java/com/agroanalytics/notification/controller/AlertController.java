package com.agroanalytics.notification.controller;

import com.agroanalytics.notification.dto.AlertDto;
import com.agroanalytics.notification.service.AlertService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/alerts")
@RequiredArgsConstructor
@Slf4j
public class AlertController {

    private final AlertService alertService;

    @GetMapping
    public ResponseEntity<List<AlertDto>> getAllAlerts() {
        List<AlertDto> alerts = alertService.getAll();
        return ResponseEntity.ok(alerts);
    }

    @GetMapping("/unread-count")
    public ResponseEntity<Map<String, Long>> getUnreadCount() {
        long count = alertService.countUnread();
        return ResponseEntity.ok(Map.of("count", count));
    }

    @PatchMapping("/{id}/read")
    public ResponseEntity<AlertDto> markAlertRead(@PathVariable UUID id) {
        return alertService.markRead(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PatchMapping("/read-all")
    public ResponseEntity<Void> markAllAlertsRead() {
        alertService.markAllRead();
        return ResponseEntity.ok().build();
    }

    @PostMapping
    public ResponseEntity<AlertDto> createAlert(@RequestBody Map<String, String> body) {
        String severity = body.getOrDefault("severity", "info").toLowerCase();
        if (!java.util.Set.of("critical", "warning", "info").contains(severity)) {
            return ResponseEntity.badRequest().build();
        }

        UUID fieldId = null;
        String rawFieldId = body.get("fieldId");
        if (rawFieldId != null && !rawFieldId.isBlank()) {
            try {
                fieldId = UUID.fromString(rawFieldId);
            } catch (IllegalArgumentException e) {
                return ResponseEntity.badRequest().build();
            }
        }

        AlertDto created = alertService.createAlert(
                body.getOrDefault("type", "system"),
                severity,
                body.getOrDefault("title", "Ручной алерт"),
                body.getOrDefault("message", ""),
                fieldId,
                body.getOrDefault("fieldName", "")
        );
        return ResponseEntity.ok(created);
    }
}
