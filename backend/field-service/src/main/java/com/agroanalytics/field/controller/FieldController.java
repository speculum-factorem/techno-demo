package com.agroanalytics.field.controller;

import com.agroanalytics.field.dto.CreateFieldDto;
import com.agroanalytics.field.dto.FieldDto;
import com.agroanalytics.field.security.RequestActor;
import com.agroanalytics.field.service.FieldService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/fields")
public class FieldController {

    private final FieldService fieldService;
    private final String internalApiToken;

    public FieldController(
            FieldService fieldService,
            @Value("${agro.security.internal-api-token:}") String internalApiToken) {
        this.fieldService = fieldService;
        this.internalApiToken = internalApiToken;
    }

    @GetMapping
    public ResponseEntity<List<FieldDto>> getAllFields(
            @RequestHeader(value = "X-Organization-Id", required = false) String orgIdHeader,
            @RequestHeader(value = "X-User-Role", required = false) String roleHeader,
            @RequestHeader(value = "X-Internal-Token", required = false) String internalToken) {
        RequestActor actor = RequestActor.fromHeaders(orgIdHeader, roleHeader, internalToken, internalApiToken);
        return ResponseEntity.ok(fieldService.getAllFields(actor));
    }

    @GetMapping("/{id}")
    public ResponseEntity<FieldDto> getFieldById(
            @PathVariable UUID id,
            @RequestHeader(value = "X-Organization-Id", required = false) String orgIdHeader,
            @RequestHeader(value = "X-User-Role", required = false) String roleHeader,
            @RequestHeader(value = "X-Internal-Token", required = false) String internalToken) {
        RequestActor actor = RequestActor.fromHeaders(orgIdHeader, roleHeader, internalToken, internalApiToken);
        return ResponseEntity.ok(fieldService.getFieldById(id, actor));
    }

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
