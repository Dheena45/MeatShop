package com.freshmeat.controller.admin;

import com.freshmeat.dto.OrderDTO;
import com.freshmeat.enums.OrderStatus;
import com.freshmeat.exception.ApiResponse;
import com.freshmeat.service.OrderService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin/orders")
public class AdminOrderController {

    @Autowired
    private OrderService orderService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<OrderDTO>>> getOrders(
            @RequestParam(required = false) OrderStatus status,
            @RequestParam(required = false) String search) {
        return ResponseEntity.ok(ApiResponse.ok(orderService.adminSearch(status, search)));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<OrderDTO>> getOrder(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(orderService.getOrderForUser(id)));
    }

    @PutMapping("/{id}/status")
    public ResponseEntity<ApiResponse<OrderDTO>> updateStatus(@PathVariable Long id,
                                                              @RequestBody Map<String, String> body) {
        OrderStatus status = OrderStatus.valueOf(body.get("status"));
        return ResponseEntity.ok(ApiResponse.ok("Order status updated",
                orderService.updateOrderStatus(id, status)));
    }
}
