package com.agroanalytics.notification.service;

import com.agroanalytics.notification.dto.AlertDto;
import com.agroanalytics.notification.integration.TelegramNotificationService;
import com.agroanalytics.notification.model.Alert;
import com.agroanalytics.notification.repository.AlertRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class AlertService {

    private final AlertRepository alertRepository;
    private final TelegramNotificationService telegramNotificationService;

    public List<AlertDto> getAll() {
        return alertRepository.findAllByOrderByCreatedAtDesc()
                .stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    @Transactional
    public Optional<AlertDto> markRead(UUID id) {
        return alertRepository.findById(id)
                .map(alert -> {
                    alert.setRead(true);
                    alert.setResolvedAt(Instant.now());
                    return toDto(alertRepository.save(alert));
                });
    }

    @Transactional
    public void markAllRead() {
        List<Alert> unread = alertRepository.findAllByOrderByCreatedAtDesc()
                .stream()
                .filter(a -> !a.isRead())
                .collect(Collectors.toList());

        Instant now = Instant.now();
        unread.forEach(alert -> {
            alert.setRead(true);
            alert.setResolvedAt(now);
        });

        alertRepository.saveAll(unread);
        log.info("Marked {} alerts as read", unread.size());
    }

    @Transactional
    public AlertDto createAlert(String type, String severity, String title, String message,
                                UUID fieldId, String fieldName) {
        Alert alert = Alert.builder()
                .type(type)
                .severity(severity)
                .title(title)
                .message(message)
                .fieldId(fieldId)
                .fieldName(fieldName)
                .isRead(false)
                .createdAt(Instant.now())
                .build();

        Alert saved = alertRepository.save(alert);
        log.info("Created {} alert [{}] for field {}: {}", severity, type, fieldId, title);
        AlertDto dto = toDto(saved);
        try {
            if ("CRITICAL".equalsIgnoreCase(severity) || "HIGH".equalsIgnoreCase(severity)
                    || "WARNING".equalsIgnoreCase(severity)) {
                telegramNotificationService.sendAlertIfConfigured(title, message, severity);
            }
        } catch (Exception e) {
            log.debug("Telegram hook skipped: {}", e.getMessage());
        }
        return dto;
    }

    public long countUnread() {
        return alertRepository.countByIsReadFalse();
    }

    private AlertDto toDto(Alert alert) {
        return AlertDto.builder()
                .id(alert.getId())
                .type(alert.getType())
                .severity(alert.getSeverity())
                .title(alert.getTitle())
                .message(alert.getMessage())
                .fieldId(alert.getFieldId())
                .fieldName(alert.getFieldName())
                .isRead(alert.isRead())
                .createdAt(alert.getCreatedAt())
                .resolvedAt(alert.getResolvedAt())
                .build();
    }
}
