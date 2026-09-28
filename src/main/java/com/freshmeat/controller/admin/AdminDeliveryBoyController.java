package com.freshmeat.controller.admin;

import com.freshmeat.dto.DeliveryBoyDTO;
import com.freshmeat.dto.DeliveryBoyRequest;
import com.freshmeat.dto.DeliveryBoyStatusRequest;
import com.freshmeat.exception.ApiResponse;
import com.freshmeat.service.DeliveryService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Delivery boy management. Delivery boys are rows in the existing {@code users}
 * table with role DELIVERY_BOY, so they log in through the same JWT endpoint as
 * everyone else and their password is stored BCrypt-hashed.
 * <p>
 * There is no delete endpoint on purpose: deactivation is a soft
 * {@code enabled = false} so past deliveries keep their handler.
 */
@RestController
@RequestMapping("/api/admin/delivery-boys")
@PreAuthorize("hasRole('ADMIN')")
public class AdminDeliveryBoyController {

    @Autowired
    private DeliveryService deliveryService;

    /** All delivery boys, with assigned and completed delivery counts. */
    @GetMapping
    public ResponseEntity<ApiResponse<List<DeliveryBoyDTO>>> getDeliveryBoys(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) Boolean active) {
        return ResponseEntity.ok(ApiResponse.ok(deliveryService.listDeliveryBoys(search, active)));
    }

    /** Active-only list — what the assign dropdown is populated from. */
    @GetMapping("/active")
    public ResponseEntity<ApiResponse<List<DeliveryBoyDTO>>> getActiveDeliveryBoys() {
        return ResponseEntity.ok(ApiResponse.ok(deliveryService.listActiveDeliveryBoys()));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<DeliveryBoyDTO>> create(
            @Valid @RequestBody DeliveryBoyRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok("Delivery Boy added successfully.",
                        deliveryService.createDeliveryBoy(request)));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<DeliveryBoyDTO>> update(
            @PathVariable Long id,
            @Valid @RequestBody DeliveryBoyRequest request) {
        return ResponseEntity.ok(ApiResponse.ok("Delivery Boy updated successfully.",
                deliveryService.updateDeliveryBoy(id, request)));
    }

    /** Activate / deactivate. Soft only — delivery history is never removed. */
    @PutMapping("/{id}/status")
    public ResponseEntity<ApiResponse<DeliveryBoyDTO>> setStatus(
            @PathVariable Long id,
            @Valid @RequestBody DeliveryBoyStatusRequest request) {
        boolean active = Boolean.TRUE.equals(request.getActive());
        return ResponseEntity.ok(ApiResponse.ok(
                active ? "Delivery Boy activated successfully." : "Delivery Boy deactivated successfully.",
                deliveryService.setDeliveryBoyActive(id, active)));
    }
}
