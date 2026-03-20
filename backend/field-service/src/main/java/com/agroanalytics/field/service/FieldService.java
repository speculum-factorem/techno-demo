package com.agroanalytics.field.service;

import com.agroanalytics.field.dto.CreateFieldDto;
import com.agroanalytics.field.dto.FieldDto;
import com.agroanalytics.field.model.Field;
import com.agroanalytics.field.repository.FieldRepository;
import com.agroanalytics.field.security.RequestActor;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class FieldService {

    private static final String FIELD_EVENTS_TOPIC = "field-events";

    private final FieldRepository fieldRepository;
    private final KafkaTemplate<String, Object> kafkaTemplate;

    public List<FieldDto> getAllFields(RequestActor actor) {
        if (actor.isAdmin()) {
            return fieldRepository.findAll().stream()
                    .map(this::toDto)
                    .collect(Collectors.toList());
        }
        if (actor.organizationId() == null) {
            return List.of();
        }
        return fieldRepository.findByOrganizationId(actor.organizationId()).stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    public FieldDto getFieldById(UUID id, RequestActor actor) {
        Field field = fieldRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Field not found"));
        assertCanAccess(field, actor);
        return toDto(field);
    }

    @Transactional
    public FieldDto createField(CreateFieldDto dto, RequestActor actor) {
        if (!actor.isAdmin()) {
            if (actor.organizationId() == null) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Organization required");
            }
            dto.setOrganizationId(actor.organizationId());
        }

        Field field = Field.builder()
                .name(dto.getName())
                .area(dto.getArea())
                .cropType(dto.getCropType())
                .status(dto.getStatus() != null ? dto.getStatus() : "ACTIVE")
                .lat(dto.getLat())
                .lng(dto.getLng())
                .soilType(dto.getSoilType())
                .plantingDate(dto.getPlantingDate())
                .expectedHarvestDate(dto.getExpectedHarvestDate())
                .currentMoistureLevel(dto.getCurrentMoistureLevel())
                .organizationId(dto.getOrganizationId())
                .build();

        Field saved = fieldRepository.save(field);
        FieldDto fieldDto = toDto(saved);

        publishEvent("FIELD_CREATED", saved.getId().toString(), fieldDto);

        return fieldDto;
    }

    @Transactional
    public FieldDto updateField(UUID id, CreateFieldDto dto, RequestActor actor) {
        Field field = fieldRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Field not found"));
        assertCanAccess(field, actor);

        if (!actor.isAdmin()) {
            dto.setOrganizationId(actor.organizationId());
        }

        if (dto.getName() != null) field.setName(dto.getName());
        if (dto.getArea() != null) field.setArea(dto.getArea());
        if (dto.getCropType() != null) field.setCropType(dto.getCropType());
        if (dto.getStatus() != null) field.setStatus(dto.getStatus());
        if (dto.getLat() != null) field.setLat(dto.getLat());
        if (dto.getLng() != null) field.setLng(dto.getLng());
        if (dto.getSoilType() != null) field.setSoilType(dto.getSoilType());
        if (dto.getPlantingDate() != null) field.setPlantingDate(dto.getPlantingDate());
        if (dto.getExpectedHarvestDate() != null) field.setExpectedHarvestDate(dto.getExpectedHarvestDate());
        if (dto.getCurrentMoistureLevel() != null) field.setCurrentMoistureLevel(dto.getCurrentMoistureLevel());
        if (dto.getOrganizationId() != null) field.setOrganizationId(dto.getOrganizationId());

        Field updated = fieldRepository.save(field);
        FieldDto fieldDto = toDto(updated);

        publishEvent("FIELD_UPDATED", updated.getId().toString(), fieldDto);

        return fieldDto;
    }

    @Transactional
    public void deleteField(UUID id, RequestActor actor) {
        Field field = fieldRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Field not found"));
        assertCanAccess(field, actor);

        fieldRepository.delete(field);

        Map<String, Object> payload = new HashMap<>();
        payload.put("eventType", "FIELD_DELETED");
        payload.put("fieldId", id.toString());

        publishEvent("FIELD_DELETED", id.toString(), payload);
    }

    private void assertCanAccess(Field field, RequestActor actor) {
        if (actor.isAdmin()) {
            return;
        }
        if (actor.organizationId() == null) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "No organization in token");
        }
        if (!actor.organizationId().equals(field.getOrganizationId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied");
        }
    }

    private void publishEvent(String eventType, String key, Object payload) {
        try {
            Map<String, Object> event = new HashMap<>();
            event.put("eventType", eventType);
            event.put("payload", payload);
            kafkaTemplate.send(FIELD_EVENTS_TOPIC, key, event);
            log.info("Published {} event for field {}", eventType, key);
        } catch (Exception e) {
            log.warn("Failed to publish Kafka event {}: {}", eventType, e.getMessage());
        }
    }

    private FieldDto toDto(Field field) {
        return FieldDto.builder()
                .id(field.getId())
                .name(field.getName())
                .area(field.getArea())
                .cropType(field.getCropType())
                .status(field.getStatus())
                .lat(field.getLat())
                .lng(field.getLng())
                .soilType(field.getSoilType())
                .plantingDate(field.getPlantingDate())
                .expectedHarvestDate(field.getExpectedHarvestDate())
                .currentMoistureLevel(field.getCurrentMoistureLevel())
                .organizationId(field.getOrganizationId())
                .createdAt(field.getCreatedAt())
                .updatedAt(field.getUpdatedAt())
                .build();
    }
}
