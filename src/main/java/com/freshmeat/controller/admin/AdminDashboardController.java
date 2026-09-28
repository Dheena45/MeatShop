package com.freshmeat.controller.admin;

import com.freshmeat.dto.*;
import com.freshmeat.exception.ApiResponse;
import com.freshmeat.service.AdminService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/admin")
public class AdminDashboardController {

    @Autowired
    private AdminService adminService;

    @GetMapping("/dashboard")
    public ResponseEntity<ApiResponse<AdminDashboardDTO>> getDashboard() {
        return ResponseEntity.ok(ApiResponse.ok(adminService.getDashboardData()));
    }

    @GetMapping("/dashboard/summary")
    public ResponseEntity<ApiResponse<DashboardSummaryDTO>> getSummary(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return ResponseEntity.ok(ApiResponse.ok(adminService.getSummary(from, to)));
    }

    @GetMapping("/dashboard/revenue-trend")
    public ResponseEntity<ApiResponse<List<RevenueTrendPointDTO>>> getRevenueTrend(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return ResponseEntity.ok(ApiResponse.ok(adminService.getRevenueTrend(from, to)));
    }

    @GetMapping("/dashboard/order-status")
    public ResponseEntity<ApiResponse<List<OrderStatusCountDTO>>> getOrderStatus(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return ResponseEntity.ok(ApiResponse.ok(adminService.getOrderStatus(from, to)));
    }

    @GetMapping("/dashboard/top-products")
    public ResponseEntity<ApiResponse<List<TopProductDTO>>> getTopProducts(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return ResponseEntity.ok(ApiResponse.ok(adminService.getTopProducts(from, to)));
    }

    @GetMapping("/dashboard/category-sales")
    public ResponseEntity<ApiResponse<List<CategorySalesDTO>>> getCategorySales(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return ResponseEntity.ok(ApiResponse.ok(adminService.getCategorySales(from, to)));
    }

    @GetMapping("/dashboard/inventory-summary")
    public ResponseEntity<ApiResponse<InventorySummaryDTO>> getInventorySummary() {
        return ResponseEntity.ok(ApiResponse.ok(adminService.getInventorySummary()));
    }

    @GetMapping("/dashboard/customer-summary")
    public ResponseEntity<ApiResponse<CustomerSummaryDTO>> getCustomerSummary(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return ResponseEntity.ok(ApiResponse.ok(adminService.getCustomerSummary(from, to)));
    }

    @GetMapping("/dashboard/orders")
    public ResponseEntity<ApiResponse<List<DashboardOrderRowDTO>>> getOrders(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return ResponseEntity.ok(ApiResponse.ok(adminService.getOrders(from, to)));
    }

    @GetMapping("/dashboard/items-sold")
    public ResponseEntity<ApiResponse<Long>> getItemsSold(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return ResponseEntity.ok(ApiResponse.ok(adminService.getTotalItemsSold(from, to)));
    }

    @GetMapping("/dashboard/yearly-summary")
    public ResponseEntity<ApiResponse<YearlySummaryDTO>> getYearlySummary(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return ResponseEntity.ok(ApiResponse.ok(adminService.getYearlySummary(from, to)));
    }

    @GetMapping("/dashboard/products/{productId}/sales")
    public ResponseEntity<ApiResponse<ProductSalesDTO>> getProductSales(
            @PathVariable Long productId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return ResponseEntity.ok(ApiResponse.ok(adminService.getProductSales(productId, from, to)));
    }
}