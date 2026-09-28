package com.freshmeat.controller.admin;

import com.freshmeat.dto.SiteSettingsDTO;
import com.freshmeat.exception.ApiResponse;
import com.freshmeat.service.SiteSettingsService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/site-settings")
public class AdminSiteSettingsController {

    @Autowired
    private SiteSettingsService siteSettingsService;

    @GetMapping
    public ResponseEntity<ApiResponse<SiteSettingsDTO>> getSiteSettings() {
        return ResponseEntity.ok(ApiResponse.ok(siteSettingsService.getSettings()));
    }

    @PutMapping
    public ResponseEntity<ApiResponse<SiteSettingsDTO>> updateSiteSettings(
            @Valid @RequestBody SiteSettingsDTO dto) {
        return ResponseEntity.ok(
                ApiResponse.ok("Site settings updated successfully.", siteSettingsService.updateSettings(dto)));
    }
}