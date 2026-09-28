package com.freshmeat.controller;

import com.freshmeat.dto.DeliveryBoySummaryDTO;
import com.freshmeat.dto.OrderDTO;
import com.freshmeat.enums.DeliveryState;
import com.freshmeat.exception.ApiResponse;
import com.freshmeat.service.DeliveryService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/**
 * The delivery boy's own API surface. It deliberately exposes deliveries and
 * nothing else — there is no product, category, customer, settings, pricing or
 * admin endpoint reachable from a DELIVERY_BOY token.
 * <p>
 * Every handler re-checks three things server side: that the caller holds the
 * DELIVERY_BOY role, that the order is in a status the action allows, and that
 * the order is assigned to *this* delivery boy. Editing the order id in the URL
 * therefore returns 403 rather than another boy's delivery.
 */
@RestController
@RequestMapping("/api/delivery")
@PreAuthorize("hasRole('DELIVERY_BOY')")
public class DeliveryBoyController {

    @Autowired
    private DeliveryService deliveryService;

    /** Today's work list — the default view of the dashboard. */
    @GetMapping("/my-deliveries")
    public ResponseEntity<ApiResponse<List<OrderDTO>>> getMyDeliveries(
            @RequestParam(required = false) String search) {
        return ResponseEntity.ok(ApiResponse.ok(deliveryService.myTodayDeliveries(search)));
    }

    /**
     * Full list of this boy's deliveries with optional state / date filters.
     * Cancelled orders are never returned.
     */
    @GetMapping("/all")
    public ResponseEntity<ApiResponse<List<OrderDTO>>> getAllDeliveries(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) DeliveryState state,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return ResponseEntity.ok(ApiResponse.ok(deliveryService.myDeliveries(search, state, date)));
    }

    /** Card counters: today's, pending, out for delivery, completed. */
    @GetMapping("/summary")
    public ResponseEntity<ApiResponse<DeliveryBoySummaryDTO>> getSummary() {
        return ResponseEntity.ok(ApiResponse.ok(deliveryService.mySummary()));
    }

    /** One delivery, including the address snapshot stored with the order. */
    @GetMapping("/{orderId}")
    public ResponseEntity<ApiResponse<OrderDTO>> getDelivery(@PathVariable Long orderId) {
        return ResponseEntity.ok(ApiResponse.ok(deliveryService.myDeliveryDetail(orderId)));
    }

    /** Start delivery: allowed only from PREPARING, which moves the order to OUT_FOR_DELIVERY. */
    @PutMapping("/{orderId}/start")
    public ResponseEntity<ApiResponse<OrderDTO>> startDelivery(@PathVariable Long orderId) {
        return ResponseEntity.ok(ApiResponse.ok(
                "Delivery started successfully.", deliveryService.startDelivery(orderId)));
    }

    /**
     * Mark delivered. Requires the order to be OUT_FOR_DELIVERY and its payment
     * to be PAID, so an unpaid COD order has to be collected first.
     */
    @PutMapping("/{orderId}/delivered")
    public ResponseEntity<ApiResponse<OrderDTO>> markDelivered(@PathVariable Long orderId) {
        return ResponseEntity.ok(ApiResponse.ok(
                "Order marked as delivered.", deliveryService.markDelivered(orderId)));
    }

    /**
     * Cash collected at the door for a COD order. This only flips the payment to
     * PAID — the order deliberately stays OUT_FOR_DELIVERY until Mark Delivered.
     * Never reachable for online payments.
     */
    @PutMapping("/{orderId}/payment-received")
    public ResponseEntity<ApiResponse<OrderDTO>> collectCash(
            @PathVariable Long orderId,
            @RequestBody(required = false) Map<String, String> body) {
        String transactionRef = body != null ? body.get("transactionRef") : null;
        return ResponseEntity.ok(ApiResponse.ok(
                "Payment received successfully.", deliveryService.collectCash(orderId, transactionRef)));
    }
}
