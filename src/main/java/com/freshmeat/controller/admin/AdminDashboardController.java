package com.freshmeat.controller.admin;

import com.freshmeat.dto.AdminDashboardDTO;
import com.freshmeat.exception.ApiResponse;
import com.freshmeat.service.AdminService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/admin")
public class AdminDashboardController {

    @Autowired
    private AdminService adminService;

    @GetMapping("/dashboard")
    public ResponseEntity<ApiResponse<AdminDashboardDTO>> getDashboard() {
        return ResponseEntity.ok(ApiResponse.ok(adminService.getDashboardData()));
    }
}
