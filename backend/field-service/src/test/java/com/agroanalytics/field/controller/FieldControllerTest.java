package com.agroanalytics.field.controller;

import com.agroanalytics.field.dto.CreateFieldDto;
import com.agroanalytics.field.dto.FieldDto;
import com.agroanalytics.field.security.RequestActor;
import com.agroanalytics.field.service.FieldService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(controllers = FieldController.class)
@org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc(addFilters = false)
@TestPropertySource(properties = {
    "agro.cors.allowed-origins=http://localhost:3000",
    "agro.security.internal-api-token=test-token"
})
class FieldControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private FieldService fieldService;

    @Test
    void getAllFields_returns200() throws Exception {
        when(fieldService.getAllFields(any(RequestActor.class))).thenReturn(List.of());

        mockMvc.perform(get("/api/fields")
                        .header("X-Organization-Id", "1")
                        .header("X-User-Role", "AGRONOMIST"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray());
    }

    @Test
    void getFieldById_returns200() throws Exception {
        UUID id = UUID.randomUUID();
        FieldDto dto = new FieldDto();
        dto.setId(id);
        dto.setName("Поле 1");
        dto.setArea(50.0);
        when(fieldService.getFieldById(eq(id), any(RequestActor.class))).thenReturn(dto);

        mockMvc.perform(get("/api/fields/{id}", id)
                        .header("X-Organization-Id", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Поле 1"))
                .andExpect(jsonPath("$.area").value(50.0));
    }

    @Test
    void createField_returns201() throws Exception {
        CreateFieldDto createDto = new CreateFieldDto();
        createDto.setName("Новое поле");
        createDto.setArea(100.0);
        createDto.setCropType("wheat");
        createDto.setLat(47.2);
        createDto.setLng(39.7);

        FieldDto created = new FieldDto();
        created.setId(UUID.randomUUID());
        created.setName("Новое поле");
        created.setArea(100.0);
        when(fieldService.createField(any(CreateFieldDto.class), any(RequestActor.class))).thenReturn(created);

        mockMvc.perform(post("/api/fields")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(createDto))
                        .header("X-Organization-Id", "1")
                        .header("X-User-Role", "AGRONOMIST"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value("Новое поле"));
    }

    @Test
    void deleteField_returns204() throws Exception {
        UUID id = UUID.randomUUID();
        doNothing().when(fieldService).deleteField(eq(id), any(RequestActor.class));

        mockMvc.perform(delete("/api/fields/{id}", id)
                        .header("X-Organization-Id", "1")
                        .header("X-User-Role", "ADMIN"))
                .andExpect(status().isNoContent());
    }
}
