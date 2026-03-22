package com.agroanalytics.field.repository;

import com.agroanalytics.field.model.FieldPassportEntry;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface FieldPassportEntryRepository extends JpaRepository<FieldPassportEntry, UUID> {

    List<FieldPassportEntry> findByFieldIdOrderByOperationDateDescSortOrderAsc(UUID fieldId);

    void deleteByFieldId(UUID fieldId);

    long countByFieldIdAndId(UUID fieldId, UUID id);
}
