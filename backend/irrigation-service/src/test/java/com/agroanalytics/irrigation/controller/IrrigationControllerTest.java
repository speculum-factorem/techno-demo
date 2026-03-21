package com.agroanalytics.irrigation.controller;

import com.agroanalytics.irrigation.dto.IrrigationTaskDto;
import com.agroanalytics.irrigation.model.IrrigationTask;
import com.agroanalytics.irrigation.service.IrrigationService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(controllers = IrrigationController.class)
@org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc(addFilters = false)
class IrrigationControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private IrrigationService irrigationService;

    @Test
    void getTasksByField_returns200() throws Exception {
        UUID fieldId = UUID.randomUUID();
        when(irrigationService.getRecommendationsByField(fieldId)).thenReturn(List.of());

        mockMvc.perform(get("/api/irrigation/fields/{fieldId}/tasks", fieldId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray());
    }

    @Test
    void createTask_returns201() throws Exception {
        IrrigationTask task = new IrrigationTask();
        task.setFieldId(UUID.randomUUID());
        IrrigationTaskDto dto = new IrrigationTaskDto();
        dto.setId(UUID.randomUUID());
        dto.setFieldId(task.getFieldId());
        when(irrigationService.createTask(any(IrrigationTask.class))).thenReturn(dto);

        mockMvc.perform(post("/api/irrigation/tasks")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(task)))
                .andExpect(status().isCreated());
    }

    @Test
    void updateStatus_returns200() throws Exception {
        UUID taskId = UUID.randomUUID();
        IrrigationTaskDto dto = new IrrigationTaskDto();
        dto.setId(taskId);
        when(irrigationService.updateStatus(eq(taskId), eq(IrrigationTask.Status.completed))).thenReturn(dto);

        mockMvc.perform(patch("/api/irrigation/tasks/{id}/status", taskId)
                        .param("status", "completed"))
                .andExpect(status().isOk());
    }
}
