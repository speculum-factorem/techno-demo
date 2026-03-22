package com.agroanalytics.field.controller;

import com.agroanalytics.field.dto.CreateFieldDto;
import com.agroanalytics.field.dto.FieldFinanceDto;
import com.agroanalytics.field.dto.FieldDto;
import com.agroanalytics.field.dto.FieldPassportDto;
import com.agroanalytics.field.dto.FieldSatelliteDto;
import com.agroanalytics.field.dto.PassportEntryWriteDto;
import com.agroanalytics.field.dto.SeasonResultWriteDto;
import com.agroanalytics.field.security.RequestActor;
import com.agroanalytics.field.service.FieldService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/fields")
@Tag(name = "Fields", description = "CRUD полей и связанные отчёты")
public class FieldController {

    private final FieldService fieldService;
    private final String internalApiToken;

    public FieldController(
            FieldService fieldService,
            @Value("${agro.security.internal-api-token:}") String internalApiToken) {
        this.fieldService = fieldService;
        this.internalApiToken = internalApiToken;
    }

    @Operation(summary = "Список полей")
    @GetMapping
    public ResponseEntity<List<FieldDto>> getAllFields(
            @RequestHeader(value = "X-Organization-Id", required = false) String orgIdHeader,
            @RequestHeader(value = "X-User-Role", required = false) String roleHeader,
            @RequestHeader(value = "X-Internal-Token", required = false) String internalToken) {
        RequestActor actor = RequestActor.fromHeaders(orgIdHeader, roleHeader, internalToken, internalApiToken);
        return ResponseEntity.ok(fieldService.getAllFields(actor));
    }

    @Operation(summary = "Получить поле по ID")
    @GetMapping("/{id}")
    public ResponseEntity<FieldDto> getFieldById(
            @PathVariable UUID id,
            @RequestHeader(value = "X-Organization-Id", required = false) String orgIdHeader,
            @RequestHeader(value = "X-User-Role", required = false) String roleHeader,
            @RequestHeader(value = "X-Internal-Token", required = false) String internalToken) {
        RequestActor actor = RequestActor.fromHeaders(orgIdHeader, roleHeader, internalToken, internalApiToken);
        return ResponseEntity.ok(fieldService.getFieldById(id, actor));
    }

    @GetMapping("/{id}/passport")
    public ResponseEntity<FieldPassportDto> getFieldPassport(
            @PathVariable UUID id,
            @RequestHeader(value = "X-Organization-Id", required = false) String orgIdHeader,
            @RequestHeader(value = "X-User-Role", required = false) String roleHeader,
            @RequestHeader(value = "X-Internal-Token", required = false) String internalToken) {
        RequestActor actor = RequestActor.fromHeaders(orgIdHeader, roleHeader, internalToken, internalApiToken);
        return ResponseEntity.ok(fieldService.getFieldPassport(id, actor));
    }

    @Operation(summary = "Добавить запись в паспорт поля (операция / удобрение / СЗР)")
    @PostMapping("/{id}/passport/entries")
    public ResponseEntity<FieldPassportDto.OperationRecord> addPassportEntry(
            @PathVariable UUID id,
            @Valid @RequestBody PassportEntryWriteDto dto,
            @RequestHeader(value = "X-Organization-Id", required = false) String orgIdHeader,
            @RequestHeader(value = "X-User-Role", required = false) String roleHeader,
            @RequestHeader(value = "X-Internal-Token", required = false) String internalToken) {
        RequestActor actor = RequestActor.fromHeaders(orgIdHeader, roleHeader, internalToken, internalApiToken);
        return ResponseEntity.status(HttpStatus.CREATED).body(fieldService.addPassportEntry(id, dto, actor));
    }

    @Operation(summary = "Обновить запись паспорта")
    @PutMapping("/{id}/passport/entries/{entryId}")
    public ResponseEntity<FieldPassportDto.OperationRecord> updatePassportEntry(
            @PathVariable UUID id,
            @PathVariable UUID entryId,
            @Valid @RequestBody PassportEntryWriteDto dto,
            @RequestHeader(value = "X-Organization-Id", required = false) String orgIdHeader,
            @RequestHeader(value = "X-User-Role", required = false) String roleHeader,
            @RequestHeader(value = "X-Internal-Token", required = false) String internalToken) {
        RequestActor actor = RequestActor.fromHeaders(orgIdHeader, roleHeader, internalToken, internalApiToken);
        return ResponseEntity.ok(fieldService.updatePassportEntry(id, entryId, dto, actor));
    }

    @Operation(summary = "Удалить запись паспорта")
    @DeleteMapping("/{id}/passport/entries/{entryId}")
    public ResponseEntity<Void> deletePassportEntry(
            @PathVariable UUID id,
            @PathVariable UUID entryId,
            @RequestHeader(value = "X-Organization-Id", required = false) String orgIdHeader,
            @RequestHeader(value = "X-User-Role", required = false) String roleHeader,
            @RequestHeader(value = "X-Internal-Token", required = false) String internalToken) {
        RequestActor actor = RequestActor.fromHeaders(orgIdHeader, roleHeader, internalToken, internalApiToken);
        fieldService.deletePassportEntry(id, entryId, actor);
        return ResponseEntity.noContent().build();
    }

    @Operation(summary = "Добавить строку результатов по сезону")
    @PostMapping("/{id}/passport/seasons")
    public ResponseEntity<FieldPassportDto.ResultRecord> addSeasonResult(
            @PathVariable UUID id,
            @Valid @RequestBody SeasonResultWriteDto dto,
            @RequestHeader(value = "X-Organization-Id", required = false) String orgIdHeader,
            @RequestHeader(value = "X-User-Role", required = false) String roleHeader,
            @RequestHeader(value = "X-Internal-Token", required = false) String internalToken) {
        RequestActor actor = RequestActor.fromHeaders(orgIdHeader, roleHeader, internalToken, internalApiToken);
        return ResponseEntity.status(HttpStatus.CREATED).body(fieldService.addSeasonResult(id, dto, actor));
    }

    @Operation(summary = "Обновить результаты сезона")
    @PutMapping("/{id}/passport/seasons/{resultId}")
    public ResponseEntity<FieldPassportDto.ResultRecord> updateSeasonResult(
            @PathVariable UUID id,
            @PathVariable UUID resultId,
            @Valid @RequestBody SeasonResultWriteDto dto,
            @RequestHeader(value = "X-Organization-Id", required = false) String orgIdHeader,
            @RequestHeader(value = "X-User-Role", required = false) String roleHeader,
            @RequestHeader(value = "X-Internal-Token", required = false) String internalToken) {
        RequestActor actor = RequestActor.fromHeaders(orgIdHeader, roleHeader, internalToken, internalApiToken);
        return ResponseEntity.ok(fieldService.updateSeasonResult(id, resultId, dto, actor));
    }

    @Operation(summary = "Удалить строку сезона")
    @DeleteMapping("/{id}/passport/seasons/{resultId}")
    public ResponseEntity<Void> deleteSeasonResult(
            @PathVariable UUID id,
            @PathVariable UUID resultId,
            @RequestHeader(value = "X-Organization-Id", required = false) String orgIdHeader,
            @RequestHeader(value = "X-User-Role", required = false) String roleHeader,
            @RequestHeader(value = "X-Internal-Token", required = false) String internalToken) {
        RequestActor actor = RequestActor.fromHeaders(orgIdHeader, roleHeader, internalToken, internalApiToken);
        fieldService.deleteSeasonResult(id, resultId, actor);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{id}/satellite")
    public ResponseEntity<FieldSatelliteDto> getFieldSatellite(
            @PathVariable UUID id,
            @RequestParam(defaultValue = "14") int days,
            @RequestHeader(value = "X-Organization-Id", required = false) String orgIdHeader,
            @RequestHeader(value = "X-User-Role", required = false) String roleHeader,
            @RequestHeader(value = "X-Internal-Token", required = false) String internalToken) {
        RequestActor actor = RequestActor.fromHeaders(orgIdHeader, roleHeader, internalToken, internalApiToken);
        return ResponseEntity.ok(fieldService.getFieldSatellite(id, days, actor));
    }

    @GetMapping("/{id}/finance")
    public ResponseEntity<FieldFinanceDto> getFieldFinance(
            @PathVariable UUID id,
            @RequestHeader(value = "X-Organization-Id", required = false) String orgIdHeader,
            @RequestHeader(value = "X-User-Role", required = false) String roleHeader,
            @RequestHeader(value = "X-Internal-Token", required = false) String internalToken) {
        RequestActor actor = RequestActor.fromHeaders(orgIdHeader, roleHeader, internalToken, internalApiToken);
        return ResponseEntity.ok(fieldService.getFieldFinance(id, actor));
    }

    @Operation(summary = "Создать поле")
    @PostMapping
    public ResponseEntity<FieldDto> createField(
            @Valid @RequestBody CreateFieldDto dto,
            @RequestHeader(value = "X-Organization-Id", required = false) String orgIdHeader,
            @RequestHeader(value = "X-User-Role", required = false) String roleHeader,
            @RequestHeader(value = "X-Internal-Token", required = false) String internalToken) {
        RequestActor actor = RequestActor.fromHeaders(orgIdHeader, roleHeader, internalToken, internalApiToken);
        FieldDto created = fieldService.createField(dto, actor);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @PutMapping("/{id}")
    public ResponseEntity<FieldDto> updateField(
            @PathVariable UUID id,
            @RequestBody CreateFieldDto dto,
            @RequestHeader(value = "X-Organization-Id", required = false) String orgIdHeader,
            @RequestHeader(value = "X-User-Role", required = false) String roleHeader,
            @RequestHeader(value = "X-Internal-Token", required = false) String internalToken) {
        RequestActor actor = RequestActor.fromHeaders(orgIdHeader, roleHeader, internalToken, internalApiToken);
        return ResponseEntity.ok(fieldService.updateField(id, dto, actor));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteField(
            @PathVariable UUID id,
            @RequestHeader(value = "X-Organization-Id", required = false) String orgIdHeader,
            @RequestHeader(value = "X-User-Role", required = false) String roleHeader,
            @RequestHeader(value = "X-Internal-Token", required = false) String internalToken) {
        RequestActor actor = RequestActor.fromHeaders(orgIdHeader, roleHeader, internalToken, internalApiToken);
        fieldService.deleteField(id, actor);
        return ResponseEntity.noContent().build();
    }
}
