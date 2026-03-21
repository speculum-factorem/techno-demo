package com.agroanalytics.notification.integration;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

import java.util.Optional;

/**
 * Отправляет email-уведомления об алертах через Яндекс SMTP.
 * Включается через NOTIFICATION_EMAIL_ENABLED=true в .env
 */
@Service
@Slf4j
public class EmailNotificationService {

    private final Optional<JavaMailSender> mailSender;
    private final boolean enabled;
    private final String from;
    private final String to;
    private final String appBaseUrl;

    public EmailNotificationService(
            @Autowired(required = false) JavaMailSender mailSender,
            @Value("${notifications.email.enabled:false}") boolean enabled,
            @Value("${notifications.email.from:}") String from,
            @Value("${notifications.email.to:}") String to,
            @Value("${app.frontend-url:http://localhost:3000}") String appBaseUrl) {
        this.mailSender = Optional.ofNullable(mailSender);
        this.enabled = enabled;
        this.from = from;
        this.to = to;
        this.appBaseUrl = appBaseUrl.endsWith("/") ? appBaseUrl.substring(0, appBaseUrl.length() - 1) : appBaseUrl;
    }

    public void sendAlertIfConfigured(String title, String message, String severity, String fieldName) {
        if (!enabled) {
            log.debug("Email notifications disabled, skipping alert: {}", title);
            return;
        }
        if (to == null || to.isBlank()) {
            log.warn("NOTIFICATION_EMAIL_TO not configured, cannot send email alert");
            return;
        }
        if (mailSender.isEmpty()) {
            log.warn("JavaMailSender not available, cannot send email alert");
            return;
        }

        String severityRu = switch (severity.toUpperCase()) {
            case "CRITICAL" -> "КРИТИЧЕСКИЙ";
            case "HIGH"     -> "ВЫСОКИЙ";
            case "WARNING"  -> "ПРЕДУПРЕЖДЕНИЕ";
            default         -> severity;
        };

        String subject = "[AgroAnalytics] " + severityRu + ": " + title;
        String body = buildBody(title, message, severity, fieldName);

        try {
            SimpleMailMessage mail = new SimpleMailMessage();
            mail.setFrom(from);
            mail.setTo(to);
            mail.setSubject(subject);
            mail.setText(body);
            mailSender.get().send(mail);
            log.info("Email alert sent to {} — [{}] {}", to, severity, title);
        } catch (Exception e) {
            log.warn("Failed to send email alert to {}: {}", to, e.getMessage());
        }
    }

    private String buildBody(String title, String message, String severity, String fieldName) {
        StringBuilder sb = new StringBuilder();
        sb.append("AgroAnalytics — Система мониторинга полей\n");
        sb.append("=".repeat(50)).append("\n\n");
        sb.append("УРОВЕНЬ: ").append(severity.toUpperCase()).append("\n");
        if (fieldName != null && !fieldName.isBlank()) {
            sb.append("ПОЛЕ: ").append(fieldName).append("\n");
        }
        sb.append("СОБЫТИЕ: ").append(title).append("\n\n");
        sb.append("ДЕТАЛИ:\n").append(message).append("\n\n");
        sb.append("-".repeat(50)).append("\n");
        sb.append("Перейдите в приложение для подробностей: ").append(appBaseUrl).append("\n");
        sb.append("Это автоматическое уведомление — отвечать не нужно.");
        return sb.toString();
    }
}
