package com.agroanalytics.notification.integration;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.HashMap;
import java.util.Map;

/**
 * Optional push to Telegram when {@code notifications.telegram.enabled=true} and token/chat are set.
 */
@Service
@Slf4j
public class TelegramNotificationService {

    private final RestTemplate restTemplate = new RestTemplate();
    private final String botToken;
    private final String chatId;
    private final boolean enabled;

    public TelegramNotificationService(
            @Value("${notifications.telegram.bot-token:}") String botToken,
            @Value("${notifications.telegram.chat-id:}") String chatId,
            @Value("${notifications.telegram.enabled:false}") boolean enabled) {
        this.botToken = botToken;
        this.chatId = chatId;
        this.enabled = enabled;
    }

    public void sendAlertIfConfigured(String title, String message, String severity) {
        if (!enabled || botToken == null || botToken.isBlank() || chatId == null || chatId.isBlank()) {
            return;
        }
        String url = "https://api.telegram.org/bot" + botToken + "/sendMessage";
        String text = "<b>" + escapeHtml(title) + "</b>\n" + escapeHtml(message) + "\n#" + escapeHtml(severity);
        Map<String, Object> body = new HashMap<>();
        body.put("chat_id", chatId);
        body.put("text", text);
        body.put("parse_mode", "HTML");
        body.put("disable_web_page_preview", true);
        try {
            restTemplate.postForEntity(url, body, String.class);
            log.debug("Telegram notification sent for alert: {}", title);
        } catch (Exception e) {
            log.warn("Telegram notification failed: {}", e.getMessage());
        }
    }

    private static String escapeHtml(String raw) {
        if (raw == null) {
            return "";
        }
        return raw.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
    }
}
