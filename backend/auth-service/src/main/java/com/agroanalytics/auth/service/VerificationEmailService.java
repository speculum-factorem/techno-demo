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
}
