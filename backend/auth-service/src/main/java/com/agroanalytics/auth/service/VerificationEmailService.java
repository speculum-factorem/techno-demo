package com.agroanalytics.auth.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.MailException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
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

    public void sendVerificationEmail(String toEmail, String token, String verificationCode) {
        String verifyLink = frontendUrl + "/auth/verify-email?token=" + token;
        String subject = "Код подтверждения AgroAnalytics";
        String body = "Здравствуйте!\n\n"
                + "Вы зарегистрировались в AgroAnalytics.\n\n"
                + "Код подтверждения email: " + verificationCode + "\n\n"
                + "Введите этот код на странице подтверждения в приложении.\n\n"
                + "Или перейдите по ссылке:\n"
                + verifyLink + "\n\n"
                + "Если вы не регистрировались, проигнорируйте это письмо.";

        if (mailSender.isPresent()) {
            try {
                SimpleMailMessage message = new SimpleMailMessage();
                message.setFrom(mailFrom);
                message.setTo(toEmail);
                message.setSubject(subject);
                message.setText(body);
                mailSender.get().send(message);
                return;
            } catch (MailException ex) {
                log.warn("Failed to send verification email to {} via SMTP, fallback to logs: {}", toEmail, ex.getMessage());
            }
        }

        // Dev/local fallback so flow remains testable without SMTP.
        log.info("Email verification for {} — code: {} — link: {}", toEmail, verificationCode, verifyLink);
    }

    public boolean isMailConfigured() {
        return mailSender.isPresent();
    }

    public void sendPasswordResetEmail(String toEmail, String token) {
        String resetLink = frontendUrl + "/auth/reset-password?token=" + token;
        String subject = "Сброс пароля AgroAnalytics";
        String body = "Здравствуйте!\n\n"
                + "Получен запрос на сброс пароля вашего аккаунта AgroAnalytics.\n\n"
                + "Перейдите по ссылке для установки нового пароля:\n"
                + resetLink + "\n\n"
                + "Ссылка действительна в течение 30 минут.\n\n"
                + "Если вы не запрашивали сброс пароля, проигнорируйте это письмо.";

        if (mailSender.isPresent()) {
            try {
                SimpleMailMessage message = new SimpleMailMessage();
                message.setFrom(mailFrom);
                message.setTo(toEmail);
                message.setSubject(subject);
                message.setText(body);
                mailSender.get().send(message);
                return;
            } catch (MailException ex) {
                log.warn("Failed to send password reset email to {} via SMTP, fallback to logs: {}", toEmail, ex.getMessage());
            }
        }

        // Dev/local fallback so flow remains testable without SMTP.
        log.info("Password reset for {} — link: {}", toEmail, resetLink);
    }

    public void sendLoginCodeEmail(String toEmail, String verificationCode) {
        String subject = "Код входа в AgroAnalytics";
        String body = "Здравствуйте!\n\n"
                + "Получен запрос на вход в ваш аккаунт AgroAnalytics.\n\n"
                + "Код подтверждения входа: " + verificationCode + "\n\n"
                + "Введите этот код в модальном окне авторизации.\n\n"
                + "Если это были не вы, смените пароль и проигнорируйте это письмо.";

        if (mailSender.isPresent()) {
            try {
                SimpleMailMessage message = new SimpleMailMessage();
                message.setFrom(mailFrom);
                message.setTo(toEmail);
                message.setSubject(subject);
                message.setText(body);
                mailSender.get().send(message);
                return;
            } catch (MailException ex) {
                log.warn("Failed to send login code email to {} via SMTP, fallback to logs: {}", toEmail, ex.getMessage());
            }
        }

        // Dev/local fallback so flow remains testable without SMTP.
        log.info("Login verification for {} — code: {}", toEmail, verificationCode);
    }
}
