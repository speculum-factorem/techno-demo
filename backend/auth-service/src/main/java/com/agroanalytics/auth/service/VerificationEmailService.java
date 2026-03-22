package com.agroanalytics.auth.service;

import jakarta.mail.internet.MimeMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.MailException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

import java.util.Optional;

@Service
@RequiredArgsConstructor
@Slf4j
public class VerificationEmailService {
    private final Optional<JavaMailSender> mailSender;

    @Value("${app.frontend-url:http://localhost:3000}")
    private String frontendUrl;

    @Value("${spring.mail.username:}")
    private String mailFrom;

    // ─── Verification email ──────────────────────────────────────────────────

    public void sendVerificationEmail(String toEmail, String token, String verificationCode) {
        String verifyLink = frontendUrl + "/auth/verify-email?token=" + token;
        String subject = "✅ Подтвердите email — АгроАналитика";
        String html = buildVerificationHtml(verificationCode, verifyLink);
        sendHtml(toEmail, subject, html);
        if (!isMailConfigured()) {
            log.info("Email verification for {} — code: {} — link: {}", toEmail, verificationCode, verifyLink);
        }
    }

    public void sendPasswordResetEmail(String toEmail, String token) {
        String resetLink = frontendUrl + "/auth/reset-password?token=" + token;
        String subject = "🔑 Сброс пароля — АгроАналитика";
        String html = buildPasswordResetHtml(resetLink);
        sendHtml(toEmail, subject, html);
        if (!isMailConfigured()) {
            log.info("Password reset for {} — link: {}", toEmail, resetLink);
        }
    }

    public void sendLoginCodeEmail(String toEmail, String verificationCode) {
        String subject = "🔐 Код входа — АгроАналитика";
        String html = buildLoginCodeHtml(verificationCode);
        sendHtml(toEmail, subject, html);
        if (!isMailConfigured()) {
            log.info("Login verification for {} — code: {}", toEmail, verificationCode);
        }
    }

    public boolean isMailConfigured() {
        return mailSender.isPresent();
    }

    // ─── Send helper ─────────────────────────────────────────────────────────

    private void sendHtml(String to, String subject, String html) {
        if (mailSender.isEmpty()) return;
        try {
            MimeMessage message = mailSender.get().createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setFrom(mailFrom);
            helper.setTo(to);
            helper.setSubject(subject);
            helper.setText(html, true);
            mailSender.get().send(message);
        } catch (MailException | jakarta.mail.MessagingException ex) {
            log.warn("Failed to send email to {}: {}", to, ex.getMessage());
        }
    }

    // ─── HTML Templates ──────────────────────────────────────────────────────

    private String baseTemplate(String title, String preheader, String content) {
        return "<!DOCTYPE html>" +
            "<html lang='ru'>" +
            "<head>" +
            "<meta charset='UTF-8'/>" +
            "<meta name='viewport' content='width=device-width, initial-scale=1.0'/>" +
            "<title>" + title + "</title>" +
            "</head>" +
            "<body style='margin:0;padding:0;background:#f1f3f4;font-family:Arial,Helvetica,sans-serif;'>" +
            "<span style='display:none;max-height:0;overflow:hidden;'>" + preheader + "</span>" +

            // Outer wrapper
            "<table role='presentation' width='100%' cellpadding='0' cellspacing='0' border='0'" +
            "  style='background:#f1f3f4;min-height:100vh;'>" +
            "<tr><td align='center' style='padding:40px 16px;'>" +

            // Card
            "<table role='presentation' width='100%' cellpadding='0' cellspacing='0' border='0'" +
            "  style='max-width:560px;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.10);'>" +

            // Header gradient
            "<tr><td style='background:linear-gradient(135deg,#1a73e8 0%,#0d5bba 55%,#34a853 100%);" +
            "  padding:36px 40px 32px;text-align:center;'>" +
            "<div style='display:inline-block;background:rgba(255,255,255,0.15);border-radius:50%;" +
            "  width:56px;height:56px;line-height:56px;font-size:28px;margin-bottom:16px;'>🌿</div>" +
            "<div style='font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;'>" +
            "АгроАналитика</div>" +
            "<div style='font-size:13px;color:rgba(255,255,255,0.75);margin-top:4px;'>" +
            "Предиктивная аналитика полей · Центр-Инвест</div>" +
            "</td></tr>" +

            // Body
            "<tr><td style='background:#ffffff;padding:36px 40px 32px;'>" +
            content +
            "</td></tr>" +

            // Footer
            "<tr><td style='background:#f8f9fa;padding:20px 40px;text-align:center;" +
            "  border-top:1px solid #e8eaed;'>" +
            "<p style='margin:0 0 6px;font-size:12px;color:#9aa0a6;'>" +
            "Это автоматическое письмо — отвечать не нужно.</p>" +
            "<p style='margin:0;font-size:12px;color:#9aa0a6;'>" +
            "© 2025 АгроАналитика · Центр-Инвест</p>" +
            "</td></tr>" +

            "</table>" + // /card
            "</td></tr></table>" + // /outer
            "</body></html>";
    }

    private String buildVerificationHtml(String code, String verifyLink) {
        // Split code into individual digit boxes
        String[] digits = code.split("");
        StringBuilder digitBoxes = new StringBuilder();
        for (String d : digits) {
            digitBoxes.append(
                "<td style='padding:0 4px;'>" +
                "<div style='width:44px;height:52px;line-height:52px;text-align:center;" +
                "  font-size:24px;font-weight:800;color:#1a73e8;background:#e8f0fe;" +
                "  border-radius:10px;border:2px solid #c5d8fb;'>" + d + "</div>" +
                "</td>"
            );
        }

        String content =
            "<h2 style='margin:0 0 8px;font-size:22px;font-weight:700;color:#202124;'>Подтвердите email</h2>" +
            "<p style='margin:0 0 24px;font-size:15px;color:#5f6368;line-height:1.5;'>" +
            "Спасибо за регистрацию в АгроАналитике! Введите код ниже или перейдите по ссылке, " +
            "чтобы завершить создание аккаунта.</p>" +

            // Code
            "<p style='margin:0 0 12px;font-size:13px;font-weight:600;color:#5f6368;" +
            "  text-transform:uppercase;letter-spacing:0.5px;'>Ваш код подтверждения</p>" +
            "<table role='presentation' cellpadding='0' cellspacing='0' border='0' style='margin-bottom:24px;'>" +
            "<tr>" + digitBoxes + "</tr></table>" +

            "<p style='margin:0 0 8px;font-size:13px;color:#9aa0a6;'>Или подтвердите по ссылке:</p>" +

            // Button
            "<table role='presentation' cellpadding='0' cellspacing='0' border='0' style='margin-bottom:28px;'><tr>" +
            "<td style='border-radius:10px;background:linear-gradient(135deg,#1a73e8,#34a853);'>" +
            "<a href='" + verifyLink + "' target='_blank'" +
            "  style='display:inline-block;padding:14px 32px;font-size:15px;font-weight:700;" +
            "  color:#ffffff;text-decoration:none;border-radius:10px;letter-spacing:0.2px;'>" +
            "Подтвердить email →</a>" +
            "</td></tr></table>" +

            "<div style='background:#fff8e1;border:1px solid #fdd835;border-radius:10px;padding:14px 16px;'>" +
            "<p style='margin:0;font-size:13px;color:#795548;line-height:1.5;'>" +
            "⏱ Код и ссылка действительны 24 часа. Если вы не регистрировались — " +
            "проигнорируйте это письмо.</p>" +
            "</div>";

        return baseTemplate("Подтверждение email — АгроАналитика",
            "Ваш код подтверждения: " + code, content);
    }

    private String buildPasswordResetHtml(String resetLink) {
        String content =
            "<h2 style='margin:0 0 8px;font-size:22px;font-weight:700;color:#202124;'>Сброс пароля</h2>" +
            "<p style='margin:0 0 24px;font-size:15px;color:#5f6368;line-height:1.5;'>" +
            "Получен запрос на сброс пароля вашего аккаунта АгроАналитики. " +
            "Нажмите кнопку ниже, чтобы создать новый пароль.</p>" +

            // Button
            "<table role='presentation' cellpadding='0' cellspacing='0' border='0' style='margin-bottom:24px;'><tr>" +
            "<td style='border-radius:10px;background:linear-gradient(135deg,#1a73e8,#0d5bba);'>" +
            "<a href='" + resetLink + "' target='_blank'" +
            "  style='display:inline-block;padding:14px 32px;font-size:15px;font-weight:700;" +
            "  color:#ffffff;text-decoration:none;border-radius:10px;'>" +
            "Сбросить пароль →</a>" +
            "</td></tr></table>" +

            "<p style='margin:0 0 20px;font-size:13px;color:#9aa0a6;'>Или скопируйте ссылку в браузер:<br/>" +
            "<span style='color:#1a73e8;word-break:break-all;'>" + resetLink + "</span></p>" +

            "<div style='background:#fce8e6;border:1px solid #f5c6c3;border-radius:10px;padding:14px 16px;'>" +
            "<p style='margin:0;font-size:13px;color:#c62828;line-height:1.5;'>" +
            "⚠️ Ссылка действительна 30 минут. Если вы не запрашивали сброс — " +
            "проигнорируйте письмо. Ваш пароль останется прежним.</p>" +
            "</div>";

        return baseTemplate("Сброс пароля — АгроАналитика",
            "Нажмите кнопку, чтобы сбросить пароль", content);
    }

    private String buildLoginCodeHtml(String code) {
        String[] digits = code.split("");
        StringBuilder digitBoxes = new StringBuilder();
        for (String d : digits) {
            digitBoxes.append(
                "<td style='padding:0 4px;'>" +
                "<div style='width:44px;height:52px;line-height:52px;text-align:center;" +
                "  font-size:24px;font-weight:800;color:#34a853;background:#e6f4ea;" +
                "  border-radius:10px;border:2px solid #b7dfbe;'>" + d + "</div>" +
                "</td>"
            );
        }

        String content =
            "<h2 style='margin:0 0 8px;font-size:22px;font-weight:700;color:#202124;'>Код подтверждения входа</h2>" +
            "<p style='margin:0 0 24px;font-size:15px;color:#5f6368;line-height:1.5;'>" +
            "Выполнен вход в ваш аккаунт АгроАналитики. Введите этот код в окне авторизации:</p>" +

            // Code
            "<p style='margin:0 0 12px;font-size:13px;font-weight:600;color:#5f6368;" +
            "  text-transform:uppercase;letter-spacing:0.5px;'>Одноразовый код</p>" +
            "<table role='presentation' cellpadding='0' cellspacing='0' border='0' style='margin-bottom:24px;'>" +
            "<tr>" + digitBoxes + "</tr></table>" +

            "<div style='background:#e6f4ea;border:1px solid #b7dfbe;border-radius:10px;padding:14px 16px;'>" +
            "<p style='margin:0;font-size:13px;color:#2e7d32;line-height:1.5;'>" +
            "⏱ Код действителен 10 минут. Не передавайте его никому.<br/>" +
            "Если вы не выполняли вход — немедленно смените пароль.</p>" +
            "</div>";

        return baseTemplate("Код входа — АгроАналитика",
            "Ваш код входа: " + code, content);
    }
}
