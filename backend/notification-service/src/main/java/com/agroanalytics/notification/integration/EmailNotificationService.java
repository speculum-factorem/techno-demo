package com.agroanalytics.notification.integration;

import jakarta.mail.internet.MimeMessage;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

import java.util.Optional;

/**
 * Отправляет HTML email-уведомления об алертах.
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

        String emoji = switch (severity.toUpperCase()) {
            case "CRITICAL" -> "🔴";
            case "HIGH"     -> "🟠";
            default         -> "🟡";
        };

        String subject = emoji + " [АгроАналитика] " + severityRu + ": " + title;
        String html = buildAlertHtml(title, message, severity, severityRu, fieldName);

        try {
            MimeMessage mail = mailSender.get().createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(mail, true, "UTF-8");
            helper.setFrom(from);
            helper.setTo(to);
            helper.setSubject(subject);
            helper.setText(html, true);
            mailSender.get().send(mail);
            log.info("HTML email alert sent to {} — [{}] {}", to, severity, title);
        } catch (Exception e) {
            log.warn("Failed to send email alert to {}: {}", to, e.getMessage());
        }
    }

    private String buildAlertHtml(String title, String message, String severity,
                                   String severityRu, String fieldName) {
        // Severity colors
        String accentColor = switch (severity.toUpperCase()) {
            case "CRITICAL" -> "#d93025";
            case "HIGH"     -> "#e37400";
            default         -> "#f29900";
        };
        String bgColor = switch (severity.toUpperCase()) {
            case "CRITICAL" -> "#fce8e6";
            case "HIGH"     -> "#fef3e2";
            default         -> "#fff8e1";
        };
        String borderColor = switch (severity.toUpperCase()) {
            case "CRITICAL" -> "#f5c6c3";
            case "HIGH"     -> "#fdd99b";
            default         -> "#fdd835";
        };
        String emoji = switch (severity.toUpperCase()) {
            case "CRITICAL" -> "🔴";
            case "HIGH"     -> "🟠";
            default         -> "🟡";
        };

        String fieldRow = (fieldName != null && !fieldName.isBlank())
            ? "<tr><td style='padding:6px 0;font-size:13px;color:#5f6368;font-weight:600;width:120px;'>Поле</td>" +
              "<td style='padding:6px 0;font-size:13px;color:#202124;'>" + fieldName + "</td></tr>"
            : "";

        return "<!DOCTYPE html>" +
            "<html lang='ru'><head><meta charset='UTF-8'/>" +
            "<meta name='viewport' content='width=device-width,initial-scale=1.0'/></head>" +
            "<body style='margin:0;padding:0;background:#f1f3f4;font-family:Arial,Helvetica,sans-serif;'>" +

            "<table role='presentation' width='100%' cellpadding='0' cellspacing='0' border='0'" +
            "  style='background:#f1f3f4;min-height:100vh;'>" +
            "<tr><td align='center' style='padding:40px 16px;'>" +

            "<table role='presentation' width='100%' cellpadding='0' cellspacing='0' border='0'" +
            "  style='max-width:560px;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.10);'>" +

            // Header
            "<tr><td style='background:linear-gradient(135deg,#1a73e8 0%,#0d5bba 55%,#34a853 100%);" +
            "  padding:28px 40px 24px;text-align:center;'>" +
            "<div style='font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;'>🌿 АгроАналитика</div>" +
            "<div style='font-size:13px;color:rgba(255,255,255,0.75);margin-top:4px;'>Система мониторинга полей</div>" +
            "</td></tr>" +

            // Severity badge
            "<tr><td style='background:" + accentColor + ";padding:12px 40px;text-align:center;'>" +
            "<span style='font-size:14px;font-weight:800;color:#ffffff;letter-spacing:1px;'>" +
            emoji + " " + severityRu + " УРОВЕНЬ " + emoji +
            "</span>" +
            "</td></tr>" +

            // Body
            "<tr><td style='background:#ffffff;padding:32px 40px;'>" +

            "<h2 style='margin:0 0 20px;font-size:20px;font-weight:700;color:#202124;line-height:1.3;'>" +
            title + "</h2>" +

            // Meta table
            "<table role='presentation' cellpadding='0' cellspacing='0' border='0'" +
            "  style='width:100%;margin-bottom:20px;border:1px solid #e8eaed;border-radius:10px;overflow:hidden;'>" +
            "<tr style='background:#f8f9fa;'>" +
            "<td colspan='2' style='padding:10px 16px;font-size:11px;font-weight:800;color:#9aa0a6;" +
            "  text-transform:uppercase;letter-spacing:0.5px;'>Детали события</td></tr>" +
            "<tr><td style='padding:12px 16px;border-top:1px solid #e8eaed;'>" +
            "<table role='presentation' cellpadding='0' cellspacing='0' border='0' style='width:100%;'>" +
            "<tr><td style='padding:6px 0;font-size:13px;color:#5f6368;font-weight:600;width:120px;'>Уровень</td>" +
            "<td style='padding:6px 0;'>" +
            "<span style='display:inline-block;background:" + bgColor + ";color:" + accentColor + ";" +
            "  border:1px solid " + borderColor + ";border-radius:6px;padding:2px 10px;" +
            "  font-size:12px;font-weight:700;'>" + severityRu + "</span>" +
            "</td></tr>" +
            fieldRow +
            "</table>" +
            "</td></tr></table>" +

            // Message
            "<div style='background:#f8f9fa;border-left:4px solid " + accentColor + ";" +
            "  border-radius:0 8px 8px 0;padding:16px 20px;margin-bottom:28px;'>" +
            "<p style='margin:0;font-size:14px;color:#3c4043;line-height:1.6;'>" + message + "</p>" +
            "</div>" +

            // CTA button
            "<table role='presentation' cellpadding='0' cellspacing='0' border='0'><tr>" +
            "<td style='border-radius:10px;background:linear-gradient(135deg,#1a73e8,#34a853);'>" +
            "<a href='" + appBaseUrl + "/app/alerts' target='_blank'" +
            "  style='display:inline-block;padding:12px 28px;font-size:14px;font-weight:700;" +
            "  color:#ffffff;text-decoration:none;border-radius:10px;'>" +
            "Открыть в системе →</a>" +
            "</td></tr></table>" +

            "</td></tr>" + // /body

            // Footer
            "<tr><td style='background:#f8f9fa;padding:18px 40px;text-align:center;" +
            "  border-top:1px solid #e8eaed;'>" +
            "<p style='margin:0 0 4px;font-size:12px;color:#9aa0a6;'>" +
            "Это автоматическое уведомление — отвечать не нужно.</p>" +
            "<p style='margin:0;font-size:12px;color:#9aa0a6;'>© 2025 АгроАналитика</p>" +
            "</td></tr>" +

            "</table></td></tr></table>" +
            "</body></html>";
    }
}
