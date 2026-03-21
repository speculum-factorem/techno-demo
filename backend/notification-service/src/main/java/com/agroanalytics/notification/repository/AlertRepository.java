package com.agroanalytics.notification.repository;

import com.agroanalytics.notification.model.Alert;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Repository
public interface AlertRepository extends JpaRepository<Alert, UUID> {

    List<Alert> findAllByOrderByCreatedAtDesc();

    List<Alert> findByFieldIdOrderByCreatedAtDesc(UUID fieldId);

    long countByIsReadFalse();

    /** Deduplication: check if a similar alert already exists within the given time window */
    boolean existsByFieldIdAndTypeAndSeverityAndCreatedAtAfter(
            UUID fieldId, String type, String severity, Instant after);

    /** TTL cleanup: delete alerts older than the given cutoff */
    @Modifying
    @Query("DELETE FROM Alert a WHERE a.createdAt < :cutoff")
    int deleteByCreatedAtBefore(Instant cutoff);
}
