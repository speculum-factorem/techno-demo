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

    public void sendVerificationEmail(String toEmail, String token) {
        String verifyLink = frontendUrl + "/auth/verify-email?token=" + token;
        String subject = "Confirm your AgroAnalytics email";
        String body = "Welcome to AgroAnalytics!\n\n"
                + "Please confirm your email by opening the link below:\n"
                + verifyLink + "\n\n"
                + "If you did not create this account, ignore this message.";

        if (mailSender.isPresent()) {
            try {
                SimpleMailMessage message = new SimpleMailMessage();
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
        log.info("Email verification link for {}: {}", toEmail, verifyLink);
    }
}
