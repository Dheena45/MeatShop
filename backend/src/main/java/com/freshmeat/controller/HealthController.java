package com.freshmeat.controller;

import com.freshmeat.exception.ApiResponse;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Lightweight, public liveness endpoint.
 *
 * <p>Purely additive: it does not touch any existing API contract, security
 * rule or business logic. This backend is a REST API only (there is no root
 * web page), so {@code GET /api/health} is the quickest way to confirm the API
 * process is up and serving. It is publicly reachable through the existing
 * {@code anyRequest().permitAll()} fallback in {@code SecurityConfig}.
 */
@RestController
@RequestMapping("/api")
public class HealthController {

    @GetMapping("/health")
    public ResponseEntity<ApiResponse<Map<String, Object>>> health() {
        Map<String, Object> status = new LinkedHashMap<>();
        status.put("status", "UP");
        status.put("service", "FreshMeat API");
        status.put("timestamp", OffsetDateTime.now().toString());
        return ResponseEntity.ok(ApiResponse.ok("FreshMeat API is running", status));
    }
}
