package com.agroanalytics.field.service;

import com.agroanalytics.field.dto.CreateFieldDto;
import com.agroanalytics.field.dto.FieldFinanceDto;
import com.agroanalytics.field.dto.FieldDto;
import com.agroanalytics.field.dto.FieldPassportDto;
import com.agroanalytics.field.dto.FieldSatelliteDto;
import com.agroanalytics.field.dto.PassportEntryWriteDto;
import com.agroanalytics.field.dto.SeasonResultWriteDto;
import com.agroanalytics.field.model.Field;
import com.agroanalytics.field.model.FieldPassportEntry;
import com.agroanalytics.field.model.FieldPassportSeasonResult;
import com.agroanalytics.field.model.PassportEntryCategory;
import com.agroanalytics.field.repository.FieldPassportEntryRepository;
import com.agroanalytics.field.repository.FieldPassportSeasonResultRepository;
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
import java.util.stream.Stream;
import java.time.LocalDate;
import java.util.ArrayList;

@Service
@RequiredArgsConstructor
@Slf4j
public class FieldService {

    private static final String FIELD_EVENTS_TOPIC = "field-events";

    private final FieldRepository fieldRepository;
    private final FieldPassportEntryRepository passportEntryRepository;
    private final FieldPassportSeasonResultRepository passportSeasonRepository;
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

    public FieldPassportDto getFieldPassport(UUID id, RequestActor actor) {
        Field field = fieldRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Field not found"));
        assertCanAccess(field, actor);

        List<FieldPassportEntry> entries = passportEntryRepository.findByFieldIdOrderByOperationDateDescSortOrderAsc(id);
        List<FieldPassportDto.OperationRecord> operations = entries.stream()
                .filter(e -> e.getCategory() == PassportEntryCategory.OPERATION)
                .map(this::toPassportOperationDto)
                .collect(Collectors.toList());
        List<FieldPassportDto.OperationRecord> fertilizers = entries.stream()
                .filter(e -> e.getCategory() == PassportEntryCategory.FERTILIZER)
                .map(this::toPassportOperationDto)
                .collect(Collectors.toList());
        List<FieldPassportDto.OperationRecord> treatments = entries.stream()
                .filter(e -> e.getCategory() == PassportEntryCategory.TREATMENT)
                .map(this::toPassportOperationDto)
                .collect(Collectors.toList());

        List<FieldPassportDto.ResultRecord> results = passportSeasonRepository
                .findByFieldIdOrderBySortOrderDescSeasonDesc(id).stream()
                .map(this::toSeasonResultDto)
                .collect(Collectors.toList());

        double totalCost = concatCosts(operations, fertilizers, treatments);
        double totalFertilizer = fertilizers.stream().mapToDouble(v -> v.getAmount() == null ? 0.0 : v.getAmount()).sum();
        double totalWater = Stream.concat(Stream.concat(operations.stream(), fertilizers.stream()), treatments.stream())
                .filter(v -> "IRRIGATION".equals(v.getType()))
                .mapToDouble(v -> v.getAmount() == null ? 0.0 : v.getAmount())
                .sum();

        return FieldPassportDto.builder()
                .fieldId(field.getId().toString())
                .fieldName(field.getName())
                .operations(operations)
                .fertilizers(fertilizers)
                .treatments(treatments)
                .results(results)
                .totals(FieldPassportDto.PassportTotals.builder()
                        .totalCost(totalCost)
                        .totalFertilizerKg(totalFertilizer)
                        .totalWaterM3(totalWater)
                        .operationsCount(operations.size() + fertilizers.size() + treatments.size())
                        .build())
                .build();
    }

    @Transactional
    public FieldPassportDto.OperationRecord addPassportEntry(UUID fieldId, PassportEntryWriteDto dto, RequestActor actor) {
        Field field = fieldRepository.findById(fieldId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Field not found"));
        assertCanAccess(field, actor);

        int nextOrder = passportEntryRepository.findByFieldIdOrderByOperationDateDescSortOrderAsc(fieldId).stream()
                .filter(e -> e.getCategory() == dto.getCategory())
                .mapToInt(FieldPassportEntry::getSortOrder)
                .max()
                .orElse(-1) + 1;

        FieldPassportEntry saved = passportEntryRepository.save(FieldPassportEntry.builder()
                .fieldId(fieldId)
                .category(dto.getCategory())
                .operationDate(dto.getDate())
                .operationType(dto.getType())
                .description(dto.getDescription())
                .amount(dto.getAmount())
                .unit(dto.getUnit())
                .cost(dto.getCost())
                .sortOrder(nextOrder)
                .build());

        return toPassportOperationDto(saved);
    }

    @Transactional
    public FieldPassportDto.OperationRecord updatePassportEntry(UUID fieldId, UUID entryId, PassportEntryWriteDto dto, RequestActor actor) {
        Field field = fieldRepository.findById(fieldId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Field not found"));
        assertCanAccess(field, actor);
        FieldPassportEntry entry = passportEntryRepository.findById(entryId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Passport entry not found"));
        if (!entry.getFieldId().equals(fieldId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Passport entry not found");
        }

        entry.setCategory(dto.getCategory());
        entry.setOperationDate(dto.getDate());
        entry.setOperationType(dto.getType());
        entry.setDescription(dto.getDescription());
        entry.setAmount(dto.getAmount());
        entry.setUnit(dto.getUnit());
        entry.setCost(dto.getCost());

        return toPassportOperationDto(passportEntryRepository.save(entry));
    }

    @Transactional
    public void deletePassportEntry(UUID fieldId, UUID entryId, RequestActor actor) {
        Field field = fieldRepository.findById(fieldId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Field not found"));
        assertCanAccess(field, actor);
        if (passportEntryRepository.countByFieldIdAndId(fieldId, entryId) == 0) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Passport entry not found");
        }
        passportEntryRepository.deleteById(entryId);
    }

    @Transactional
    public FieldPassportDto.ResultRecord addSeasonResult(UUID fieldId, SeasonResultWriteDto dto, RequestActor actor) {
        Field field = fieldRepository.findById(fieldId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Field not found"));
        assertCanAccess(field, actor);

        int nextOrder = passportSeasonRepository.findByFieldIdOrderBySortOrderDescSeasonDesc(fieldId).stream()
                .mapToInt(FieldPassportSeasonResult::getSortOrder)
                .max()
                .orElse(-1) + 1;

        FieldPassportSeasonResult saved = passportSeasonRepository.save(FieldPassportSeasonResult.builder()
                .fieldId(fieldId)
                .season(dto.getSeason())
                .cropType(dto.getCropType())
                .yieldActual(dto.getYieldActual())
                .yieldPlan(dto.getYieldPlan())
                .revenueActual(dto.getRevenueActual())
                .costActual(dto.getCostActual())
                .sortOrder(nextOrder)
                .build());

        return toSeasonResultDto(saved);
    }

    @Transactional
    public FieldPassportDto.ResultRecord updateSeasonResult(UUID fieldId, UUID resultId, SeasonResultWriteDto dto, RequestActor actor) {
        Field field = fieldRepository.findById(fieldId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Field not found"));
        assertCanAccess(field, actor);
        FieldPassportSeasonResult row = passportSeasonRepository.findById(resultId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Season result not found"));
        if (!row.getFieldId().equals(fieldId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Season result not found");
        }

        row.setSeason(dto.getSeason());
        row.setCropType(dto.getCropType());
        row.setYieldActual(dto.getYieldActual());
        row.setYieldPlan(dto.getYieldPlan());
        row.setRevenueActual(dto.getRevenueActual());
        row.setCostActual(dto.getCostActual());

        return toSeasonResultDto(passportSeasonRepository.save(row));
    }

    @Transactional
    public void deleteSeasonResult(UUID fieldId, UUID resultId, RequestActor actor) {
        Field field = fieldRepository.findById(fieldId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Field not found"));
        assertCanAccess(field, actor);
        if (passportSeasonRepository.countByFieldIdAndId(fieldId, resultId) == 0) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Season result not found");
        }
        passportSeasonRepository.deleteById(resultId);
    }

    private FieldPassportDto.OperationRecord toPassportOperationDto(FieldPassportEntry e) {
        return FieldPassportDto.OperationRecord.builder()
                .id(e.getId().toString())
                .category(e.getCategory().name())
                .date(e.getOperationDate())
                .type(e.getOperationType())
                .description(e.getDescription())
                .amount(e.getAmount())
                .unit(e.getUnit())
                .cost(e.getCost())
                .build();
    }

    private FieldPassportDto.ResultRecord toSeasonResultDto(FieldPassportSeasonResult r) {
        return FieldPassportDto.ResultRecord.builder()
                .id(r.getId().toString())
                .season(r.getSeason())
                .cropType(r.getCropType())
                .yieldActual(r.getYieldActual())
                .yieldPlan(r.getYieldPlan())
                .revenueActual(r.getRevenueActual())
                .costActual(r.getCostActual())
                .build();
    }

    public FieldSatelliteDto getFieldSatellite(UUID id, int days, RequestActor actor) {
        Field field = fieldRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Field not found"));
        assertCanAccess(field, actor);

        int points = Math.max(6, Math.min(days, 30));
        List<FieldSatelliteDto.IndexPoint> timeline = new ArrayList<>();
        for (int i = points - 1; i >= 0; i--) {
            LocalDate date = LocalDate.now().minusDays(i);
            double seasonality = Math.sin((points - i) / 4.0);
            double ndvi = clamp(0.42 + seasonality * 0.18 + field.getArea() * 0.0015, 0.1, 0.92);
            double ndmi = clamp(0.24 + seasonality * 0.12 + (field.getCurrentMoistureLevel() != null ? field.getCurrentMoistureLevel() : 35.0) / 300.0, 0.05, 0.85);
            timeline.add(FieldSatelliteDto.IndexPoint.builder().date(date).ndvi(round2(ndvi)).ndmi(round2(ndmi)).build());
        }

        FieldSatelliteDto.IndexPoint latest = timeline.get(timeline.size() - 1);
        String stressLevel = latest.getNdmi() < 0.28 ? "HIGH" : (latest.getNdmi() < 0.38 ? "MEDIUM" : "LOW");

        List<String> alerts = stressLevel.equals("HIGH")
                ? List.of("Высокий водный стресс по NDMI", "Снижение вегетационного индекса NDVI")
                : List.of("Критичных спутниковых отклонений не выявлено");

        List<String> recommendations = stressLevel.equals("HIGH")
                ? List.of("Запланировать внеочередной полив в ближайшие 24 часа", "Проверить капельную линию и равномерность подачи")
                : List.of("Сохранить текущий график полива", "Пересчитать индексы через 48 часов");

        return FieldSatelliteDto.builder()
                .fieldId(field.getId().toString())
                .fieldName(field.getName())
                .timeline(timeline)
                .latestNdvi(latest.getNdvi())
                .latestNdmi(latest.getNdmi())
                .stressLevel(stressLevel)
                .mapPreviewUrl(null)
                .alerts(alerts)
                .recommendations(recommendations)
                .build();
    }

    public FieldFinanceDto getFieldFinance(UUID id, RequestActor actor) {
        Field field = fieldRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Field not found"));
        assertCanAccess(field, actor);

        double area = field.getArea() != null ? field.getArea() : 1.0;

        // Yield baseline per crop type (t/ha) — used when no ML forecast is available
        double yieldPerHa = switch (field.getCropType() != null ? field.getCropType().toLowerCase() : "") {
            case "corn"        -> 6.8;
            case "sunflower"   -> 2.0;
            case "barley"      -> 3.5;
            case "soy"         -> 1.8;
            case "sugar_beet"  -> 30.0;
            default            -> 4.3; // wheat / other
        };

        // Cost per hectare varies by crop (seed + inputs differ significantly)
        double costPerHa = switch (field.getCropType() != null ? field.getCropType().toLowerCase() : "") {
            case "corn"        -> 16500.0;
            case "sugar_beet"  -> 28000.0;
            case "soy"         -> 12000.0;
            case "sunflower"   -> 10500.0;
            case "barley"      -> 9800.0;
            default            -> 11850.0;
        };

        // Price per ton varies by crop
        double pricePerTon = switch (field.getCropType() != null ? field.getCropType().toLowerCase() : "") {
            case "corn"        -> 11000.0;
            case "sunflower"   -> 28000.0;
            case "barley"      -> 10500.0;
            case "soy"         -> 34000.0;
            case "sugar_beet"  -> 3200.0;
            default            -> 13500.0;
        };

        double planCost = round2(area * costPerHa);
        double actualCost = round2(planCost * 0.94);
        double revenue = round2(area * yieldPerHa * pricePerTon);
        double margin = round2(revenue - actualCost);
        double marginPct = round2((margin / Math.max(revenue, 1.0)) * 100.0);

        List<FieldFinanceDto.CostBreakdownItem> breakdown = List.of(
                FieldFinanceDto.CostBreakdownItem.builder().category("Семена").planned(round2(planCost * 0.22)).actual(round2(actualCost * 0.23)).build(),
                FieldFinanceDto.CostBreakdownItem.builder().category("Удобрения").planned(round2(planCost * 0.28)).actual(round2(actualCost * 0.26)).build(),
                FieldFinanceDto.CostBreakdownItem.builder().category("СЗР и обработки").planned(round2(planCost * 0.18)).actual(round2(actualCost * 0.19)).build(),
                FieldFinanceDto.CostBreakdownItem.builder().category("Полив и вода").planned(round2(planCost * 0.17)).actual(round2(actualCost * 0.14)).build(),
                FieldFinanceDto.CostBreakdownItem.builder().category("Прочее").planned(round2(planCost * 0.15)).actual(round2(actualCost * 0.18)).build()
        );

        return FieldFinanceDto.builder()
                .fieldId(field.getId().toString())
                .fieldName(field.getName())
                .planCost(planCost)
                .actualCost(actualCost)
                .costPerHectare(round2(actualCost / area))
                .waterSavingPercent(13.5)
                .grossRevenue(revenue)
                .margin(margin)
                .marginPercent(marginPct)
                .breakdown(breakdown)
                .build();
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

        passportEntryRepository.deleteByFieldId(id);
        passportSeasonRepository.deleteByFieldId(id);
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

    private double concatCosts(
            List<FieldPassportDto.OperationRecord> operations,
            List<FieldPassportDto.OperationRecord> fertilizers,
            List<FieldPassportDto.OperationRecord> treatments
    ) {
        double sum = operations.stream().mapToDouble(v -> v.getCost() == null ? 0.0 : v.getCost()).sum();
        sum += fertilizers.stream().mapToDouble(v -> v.getCost() == null ? 0.0 : v.getCost()).sum();
        sum += treatments.stream().mapToDouble(v -> v.getCost() == null ? 0.0 : v.getCost()).sum();
        return round2(sum);
    }

    private double clamp(double value, double min, double max) {
        return Math.max(min, Math.min(max, value));
    }

    private double round2(double value) {
        return Math.round(value * 100.0) / 100.0;
    }
}
