package com.freshmeat.controller.admin;

import com.freshmeat.dto.AssignDeliveryRequest;
import com.freshmeat.dto.DeliveryBoardSummaryDTO;
import com.freshmeat.dto.OrderDTO;
import com.freshmeat.enums.DeliveryState;
import com.freshmeat.exception.ApiResponse;
import com.freshmeat.service.DeliveryService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.format.annotation.DateTimeFormat;
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

import java.time.LocalDate;
import java.util.List;

/**
 * Admin delivery board: what still needs a delivery boy, who is handling what,
 * what is on the road and what already landed. Reuses the existing Order and
 * Payment entities — no parallel order or payment system is introduced.
 * <p>
 * Authorisation: the whole {@code /api/admin/**} tree is {@code hasRole("ADMIN")}
 * in SecurityConfig, and each handler repeats the check with {@code @PreAuthorize}
 * so the rule survives a future mapping change.
 */
@RestController
@RequestMapping("/api/admin/delivery")
@PreAuthorize("hasRole('ADMIN')")
public class AdminDeliveryController {

    @Autowired
    private DeliveryService deliveryService;

    /**
     * Delivery board rows. Filters: delivery state tab, free text over order
     * number / customer name / customer phone, delivery boy and delivery date.
     */
    @GetMapping
    public ResponseEntity<ApiResponse<List<OrderDTO>>> getDeliveries(
            @RequestParam(required = false) DeliveryState state,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) Long deliveryBoyId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return ResponseEntity.ok(ApiResponse.ok(
                deliveryService.adminBoard(state, search, deliveryBoyId, date)));
    }

    /** Counters for the Pending Assignment / Assigned / Out for Delivery / Delivered cards. */
    @GetMapping("/summary")
    public ResponseEntity<ApiResponse<DeliveryBoardSummaryDTO>> getSummary(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) Long deliveryBoyId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return ResponseEntity.ok(ApiResponse.ok(
                deliveryService.adminBoardSummary(search, deliveryBoyId, date)));
    }

    /** Full delivery detail (assignment trail + timestamps) for one order. */
    @GetMapping("/{orderId}")
    public ResponseEntity<ApiResponse<OrderDTO>> getDelivery(@PathVariable Long orderId) {
        return ResponseEntity.ok(ApiResponse.ok(deliveryService.adminDeliveryDetail(orderId)));
    }

    /** Hand an unassigned order to a delivery boy. */
    @PostMapping("/{orderId}/assign")
    public ResponseEntity<ApiResponse<OrderDTO>> assign(
            @PathVariable Long orderId,
            @Valid @RequestBody AssignDeliveryRequest request) {
        return ResponseEntity.ok(ApiResponse.ok(
                "Delivery Boy assigned successfully.", deliveryService.assign(orderId, request)));
    }

    /**
     * Hand an already-assigned order to a different delivery boy. The previous
     * assignment row is kept as history rather than deleted.
     */
    @PutMapping("/{orderId}/reassign")
    public ResponseEntity<ApiResponse<OrderDTO>> reassign(
            @PathVariable Long orderId,
            @Valid @RequestBody AssignDeliveryRequest request) {
        return ResponseEntity.ok(ApiResponse.ok(
                "Delivery Boy reassigned successfully.", deliveryService.reassign(orderId, request)));
    }
}
