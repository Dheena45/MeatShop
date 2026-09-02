package com.freshmeat.controller;

import com.freshmeat.dto.OrderDTO;
import com.freshmeat.dto.OrderRequest;
import com.freshmeat.exception.ApiResponse;
import com.freshmeat.service.OrderService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/orders")
public class OrderController {

    @Autowired
    private OrderService orderService;

    @PostMapping
    public ResponseEntity<ApiResponse<OrderDTO>> placeOrder(@Valid @RequestBody OrderRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok("Order placed successfully", orderService.placeOrder(request)));
    }

    @GetMapping("/my-orders")
    public ResponseEntity<ApiResponse<List<OrderDTO>>> getMyOrders() {
        return ResponseEntity.ok(ApiResponse.ok(orderService.getMyOrders()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<OrderDTO>> getOrder(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(orderService.getOrderForUser(id)));
    }

    @PutMapping("/{id}/cancel")
    public ResponseEntity<ApiResponse<Void>> cancelOrder(@PathVariable Long id) {
        orderService.cancelOrder(id);
        return ResponseEntity.ok(ApiResponse.ok("Order cancelled", null));
    }
}
