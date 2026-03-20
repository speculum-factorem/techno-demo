package com.agroanalytics.field.service;

import com.agroanalytics.field.dto.CreateFieldDto;
import com.agroanalytics.field.dto.FieldFinanceDto;
import com.agroanalytics.field.dto.FieldDto;
import com.agroanalytics.field.dto.FieldPassportDto;
import com.agroanalytics.field.dto.FieldSatelliteDto;
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
import java.time.LocalDate;
import java.util.ArrayList;

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

    public FieldPassportDto getFieldPassport(UUID id, RequestActor actor) {
        Field field = fieldRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Field not found"));
        assertCanAccess(field, actor);

        List<FieldPassportDto.OperationRecord> operations = List.of(
                FieldPassportDto.OperationRecord.builder().date(LocalDate.now().minusDays(28)).type("SOIL_PREP")
                        .description("Предпосевная обработка почвы").amount(1.0).unit("операция").cost(14500.0).build(),
                FieldPassportDto.OperationRecord.builder().date(LocalDate.now().minusDays(22)).type("SEEDING")
                        .description("Посев культуры").amount(field.getArea()).unit("га").cost(21000.0).build(),
                FieldPassportDto.OperationRecord.builder().date(LocalDate.now().minusDays(8)).type("IRRIGATION")
                        .description("Плановый полив").amount(420.0).unit("м3").cost(6300.0).build()
        );

        List<FieldPassportDto.OperationRecord> fertilizers = List.of(
                FieldPassportDto.OperationRecord.builder().date(LocalDate.now().minusDays(18)).type("NPK")
                        .description("Внесение NPK 16:16:16").amount(210.0).unit("кг").cost(17200.0).build(),
                FieldPassportDto.OperationRecord.builder().date(LocalDate.now().minusDays(10)).type("UREA")
                        .description("Карбамид").amount(95.0).unit("кг").cost(7600.0).build()
        );

        List<FieldPassportDto.OperationRecord> treatments = List.of(
                FieldPassportDto.OperationRecord.builder().date(LocalDate.now().minusDays(14)).type("HERBICIDE")
                        .description("Гербицидная обработка").amount(24.0).unit("л").cost(9400.0).build(),
                FieldPassportDto.OperationRecord.builder().date(LocalDate.now().minusDays(6)).type("FUNGICIDE")
                        .description("Фунгицидная обработка").amount(18.0).unit("л").cost(8700.0).build()
        );

        List<FieldPassportDto.ResultRecord> results = List.of(
                FieldPassportDto.ResultRecord.builder().metric("Прогноз урожайности").value(4.8).unit("т/га").period("Текущий сезон").build(),
                FieldPassportDto.ResultRecord.builder().metric("Отклонение от плана").value(-3.2).unit("%").period("Текущий сезон").build(),
                FieldPassportDto.ResultRecord.builder().metric("Средняя влажность").value(field.getCurrentMoistureLevel() != null ? field.getCurrentMoistureLevel() : 41.0).unit("%").period("7 дней").build()
        );

        double totalCost = concatCosts(operations, fertilizers, treatments);
        double totalFertilizer = fertilizers.stream().mapToDouble(v -> v.getAmount() == null ? 0.0 : v.getAmount()).sum();
        double totalWater = operations.stream()
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
                .mapPreviewUrl("https://tiles.example.local/ndvi/" + field.getId())
                .alerts(alerts)
                .recommendations(recommendations)
                .build();
    }

    public FieldFinanceDto getFieldFinance(UUID id, RequestActor actor) {
        Field field = fieldRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Field not found"));
        assertCanAccess(field, actor);

        double area = field.getArea() != null ? field.getArea() : 1.0;
        double planCost = round2(area * 11850.0);
        double actualCost = round2(planCost * 0.94);
        double revenue = round2(area * 4.8 * 13500.0);
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
