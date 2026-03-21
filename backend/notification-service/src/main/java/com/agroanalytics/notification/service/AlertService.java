package com.agroanalytics.notification.service;

import com.agroanalytics.notification.dto.AlertDto;
import com.agroanalytics.notification.integration.EmailNotificationService;
import com.agroanalytics.notification.integration.TelegramNotificationService;
import com.agroanalytics.notification.model.Alert;
import com.agroanalytics.notification.repository.AlertRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
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
    private final EmailNotificationService emailNotificationService;

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
        // Deduplication: skip if a similar alert was already created within the last hour
        Instant deduplicationWindow = Instant.now().minusSeconds(3600);
        if (fieldId != null && alertRepository.existsByFieldIdAndTypeAndSeverityAndCreatedAtAfter(
                fieldId, type, severity, deduplicationWindow)) {
            log.debug("Skipping duplicate {} alert [{}] for field {} — already exists within 1h window", severity, type, fieldId);
            return null;
        }

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
        boolean isImportant = "critical".equalsIgnoreCase(severity)
                || "high".equalsIgnoreCase(severity)
                || "warning".equalsIgnoreCase(severity);
        if (isImportant) {
            try {
                telegramNotificationService.sendAlertIfConfigured(title, message, severity);
            } catch (Exception e) {
                log.debug("Telegram hook skipped: {}", e.getMessage());
            }
            try {
                emailNotificationService.sendAlertIfConfigured(title, message, severity, fieldName);
            } catch (Exception e) {
                log.debug("Email hook skipped: {}", e.getMessage());
            }
        }
        return dto;
    }

    public long countUnread() {
        return alertRepository.countByIsReadFalse();
    }

    /** TTL cleanup: runs daily at 03:00, removes alerts older than 30 days */
    @Scheduled(cron = "0 0 3 * * *")
    @Transactional
    public void cleanupOldAlerts() {
        Instant cutoff = Instant.now().minusSeconds(30L * 24 * 3600);
        int deleted = alertRepository.deleteByCreatedAtBefore(cutoff);
        if (deleted > 0) {
            log.info("TTL cleanup: removed {} alerts older than 30 days", deleted);
        }
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
