package com.agroanalytics.irrigation.repository;

import com.agroanalytics.irrigation.model.IrrigationTask;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface IrrigationTaskRepository extends JpaRepository<IrrigationTask, UUID> {
    List<IrrigationTask> findByFieldIdOrderByScheduledDateAsc(UUID fieldId);
    List<IrrigationTask> findByStatusOrderByScheduledDateAsc(IrrigationTask.Status status);
    boolean existsByFieldIdAndScheduledDateAndStatusIn(UUID fieldId, java.time.LocalDate date, List<IrrigationTask.Status> statuses);
}
