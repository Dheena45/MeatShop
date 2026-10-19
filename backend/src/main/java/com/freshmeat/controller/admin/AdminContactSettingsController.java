package com.freshmeat.controller.admin;

import com.freshmeat.dto.ContactSettingsDTO;
import com.freshmeat.exception.ApiResponse;
import com.freshmeat.service.ContactSettingsService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/contact-settings")
public class AdminContactSettingsController {

    @Autowired
    private ContactSettingsService contactSettingsService;

    @GetMapping
    public ResponseEntity<ApiResponse<ContactSettingsDTO>> getContactSettings() {
        return ResponseEntity.ok(ApiResponse.ok(contactSettingsService.getSettings()));
    }

    @PutMapping
    public ResponseEntity<ApiResponse<ContactSettingsDTO>> updateContactSettings(
            @Valid @RequestBody ContactSettingsDTO dto) {
        return ResponseEntity.ok(
                ApiResponse.ok("Contact details updated successfully.", contactSettingsService.updateSettings(dto)));
    }
}