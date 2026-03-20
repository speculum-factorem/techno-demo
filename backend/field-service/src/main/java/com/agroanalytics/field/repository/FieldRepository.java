package com.agroanalytics.field.repository;

import com.agroanalytics.field.model.Field;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface FieldRepository extends JpaRepository<Field, UUID> {
    List<Field> findByOrganizationId(Long organizationId);
}
