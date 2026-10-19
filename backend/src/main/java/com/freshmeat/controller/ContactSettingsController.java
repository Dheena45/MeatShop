package com.freshmeat.controller;

import com.freshmeat.dto.ContactSettingsDTO;
import com.freshmeat.exception.ApiResponse;
import com.freshmeat.service.ContactSettingsService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/contact-settings")
public class ContactSettingsController {

    @Autowired
    private ContactSettingsService contactSettingsService;

    @GetMapping
    public ResponseEntity<ApiResponse<ContactSettingsDTO>> getContactSettings() {
        return ResponseEntity.ok(ApiResponse.ok(contactSettingsService.getSettings()));
    }
}