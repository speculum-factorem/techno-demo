package com.agroanalytics.irrigation.service;

import com.agroanalytics.irrigation.dto.IrrigationTaskDto;
import com.agroanalytics.irrigation.model.IrrigationTask;
import com.agroanalytics.irrigation.repository.IrrigationTaskRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.http.HttpStatus;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class IrrigationService {

    private final IrrigationTaskRepository taskRepository;
    private final KafkaTemplate<String, Object> kafkaTemplate;
    private final WebClient webClient;

    public List<IrrigationTaskDto> getRecommendationsByField(UUID fieldId) {
        return taskRepository.findByFieldIdOrderByScheduledDateAsc(fieldId)
                .stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    public IrrigationTaskDto createTask(IrrigationTask task) {
        task.setCreatedAt(Instant.now());
        task.setStatus(IrrigationTask.Status.scheduled);
        IrrigationTask saved = taskRepository.save(task);
        publishIrrigationEvent(saved);
        return toDto(saved);
    }

    public IrrigationTaskDto updateStatus(UUID id, IrrigationTask.Status status) {
        if (status == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Status must not be null");
        }
        return taskRepository.findById(id).map(task -> {
            task.setStatus(status);
            if (status == IrrigationTask.Status.active) {
                task.setExecutedAt(Instant.now());
            }
            return toDto(taskRepository.save(task));
        }).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Task not found: " + id));
    }

    @Scheduled(fixedDelay = 3600000) // every hour
    public void checkPendingTasks() {
        List<IrrigationTask> scheduled = taskRepository.findByStatusOrderByScheduledDateAsc(IrrigationTask.Status.scheduled);
        scheduled.forEach(task -> {
            if (task.getScheduledDate() == null) return;
            LocalDate today = LocalDate.now();
            if (task.getScheduledDate().isBefore(today)) {
                // Overdue — mark as skipped so it doesn't re-trigger every hour
                task.setStatus(IrrigationTask.Status.skipped);
                taskRepository.save(task);
                log.info("Irrigation task {} for field {} was overdue ({}), marked skipped",
                        task.getId(), task.getFieldId(), task.getScheduledDate());
            } else if (task.getScheduledDate().isEqual(today)) {
                // Due today — activate and publish
                task.setStatus(IrrigationTask.Status.active);
                task.setExecutedAt(Instant.now());
                taskRepository.save(task);
                publishIrrigationEvent(task);
                log.info("Activated irrigation task {} for field {}: {} mm water",
                        task.getId(), task.getFieldId(), task.getWaterAmount());
            }
        });
    }

    private void publishIrrigationEvent(IrrigationTask task) {
        try {
            kafkaTemplate.send("irrigation-recommendations", task.getFieldId().toString(), toDto(task));
            log.info("Published irrigation event for field: {}", task.getFieldId());
        } catch (Exception e) {
            log.error("Failed to publish irrigation event: {}", e.getMessage());
        }
    }

    private IrrigationTaskDto toDto(IrrigationTask task) {
        return IrrigationTaskDto.builder()
                .id(task.getId())
                .fieldId(task.getFieldId())
                .fieldName(task.getFieldName())
                .scheduledDate(task.getScheduledDate())
                .waterAmount(task.getWaterAmount())
                .duration(task.getDuration())
                .priority(task.getPriority() != null ? task.getPriority().name() : null)
                .reason(task.getReason())
                .moistureDeficit(task.getMoistureDeficit())
                .confidence(task.getConfidence())
                .status(task.getStatus() != null ? task.getStatus().name() : null)
                .createdAt(task.getCreatedAt())
                .build();
    }
}
