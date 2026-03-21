package com.agroanalytics.irrigation.controller;

import com.agroanalytics.irrigation.dto.IrrigationTaskDto;
import com.agroanalytics.irrigation.model.IrrigationTask;
import com.agroanalytics.irrigation.service.IrrigationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/irrigation")
@RequiredArgsConstructor
@Tag(name = "Irrigation", description = "Задачи полива и рекомендации")
public class IrrigationController {

    private final IrrigationService irrigationService;

    @Operation(summary = "Задачи полива по полю")
    @GetMapping("/fields/{fieldId}/tasks")
    public ResponseEntity<List<IrrigationTaskDto>> getTasksByField(@PathVariable UUID fieldId) {
        return ResponseEntity.ok(irrigationService.getRecommendationsByField(fieldId));
    }

    @Operation(summary = "Создать задачу полива")
    @PostMapping("/tasks")
    public ResponseEntity<IrrigationTaskDto> createTask(@RequestBody IrrigationTask task) {
        return ResponseEntity.status(HttpStatus.CREATED).body(irrigationService.createTask(task));
    }

    @Operation(summary = "Обновить статус задачи")
    @PatchMapping("/tasks/{id}/status")
    public ResponseEntity<IrrigationTaskDto> updateStatus(
            @PathVariable UUID id,
            @RequestParam String status) {
        IrrigationTask.Status s;
        try {
            s = IrrigationTask.Status.valueOf(status.toLowerCase());
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Invalid status value: '" + status + "'. Allowed: scheduled, active, completed, cancelled, skipped");
        }
        return ResponseEntity.ok(irrigationService.updateStatus(id, s));
    }
}
