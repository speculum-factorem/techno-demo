package com.agroanalytics.irrigation.controller;

import com.agroanalytics.irrigation.dto.IrrigationTaskDto;
import com.agroanalytics.irrigation.model.IrrigationTask;
import com.agroanalytics.irrigation.service.IrrigationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/irrigation")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class IrrigationController {

    private final IrrigationService irrigationService;

    @GetMapping("/fields/{fieldId}/tasks")
    public ResponseEntity<List<IrrigationTaskDto>> getTasksByField(@PathVariable UUID fieldId) {
        return ResponseEntity.ok(irrigationService.getRecommendationsByField(fieldId));
    }

    @PostMapping("/tasks")
    public ResponseEntity<IrrigationTaskDto> createTask(@RequestBody IrrigationTask task) {
        return ResponseEntity.ok(irrigationService.createTask(task));
    }

    @PatchMapping("/tasks/{id}/status")
    public ResponseEntity<IrrigationTaskDto> updateStatus(
            @PathVariable UUID id,
            @RequestParam String status) {
        IrrigationTask.Status s = IrrigationTask.Status.valueOf(status);
        return ResponseEntity.ok(irrigationService.updateStatus(id, s));
    }
}
