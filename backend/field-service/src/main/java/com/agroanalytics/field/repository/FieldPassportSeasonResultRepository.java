package com.agroanalytics.field.repository;

import com.agroanalytics.field.model.FieldPassportSeasonResult;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface FieldPassportSeasonResultRepository extends JpaRepository<FieldPassportSeasonResult, UUID> {

    List<FieldPassportSeasonResult> findByFieldIdOrderBySortOrderDescSeasonDesc(UUID fieldId);

    void deleteByFieldId(UUID fieldId);

    long countByFieldIdAndId(UUID fieldId, UUID id);
}
