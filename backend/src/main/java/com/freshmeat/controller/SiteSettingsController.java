package com.freshmeat.controller;

import com.freshmeat.dto.SiteSettingsDTO;
import com.freshmeat.exception.ApiResponse;
import com.freshmeat.service.SiteSettingsService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/site-settings")
public class SiteSettingsController {

    @Autowired
    private SiteSettingsService siteSettingsService;

    @GetMapping
    public ResponseEntity<ApiResponse<SiteSettingsDTO>> getSiteSettings() {
        return ResponseEntity.ok(ApiResponse.ok(siteSettingsService.getSettings()));
    }
}