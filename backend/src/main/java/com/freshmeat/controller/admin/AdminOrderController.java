package com.freshmeat.controller.admin;

import com.freshmeat.dto.InvoiceDTO;
import com.freshmeat.dto.OrderDTO;
import com.freshmeat.enums.OrderStatus;
import com.freshmeat.exception.ApiResponse;
import com.freshmeat.exception.BadRequestException;
import com.freshmeat.service.InvoiceService;
import com.freshmeat.service.OrderService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin/orders")
public class AdminOrderController {

    @Autowired
    private OrderService orderService;

    @Autowired
    private InvoiceService invoiceService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<OrderDTO>>> getOrders(
            @RequestParam(required = false) OrderStatus status,
            @RequestParam(required = false) String search) {
        return ResponseEntity.ok(ApiResponse.ok(orderService.adminSearch(status, search)));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<OrderDTO>> getOrder(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(orderService.getOrderForAdmin(id)));
    }

    @PutMapping("/{id}/status")
    public ResponseEntity<ApiResponse<OrderDTO>> updateStatus(@PathVariable Long id,
                                                              @RequestBody Map<String, String> body) {
        String raw = body != null ? body.get("status") : null;
        if (raw == null || raw.trim().isEmpty()) {
            throw new BadRequestException("Order status is required");
        }
        OrderStatus status;
        try {
            status = OrderStatus.valueOf(raw);
        } catch (IllegalArgumentException ex) {
            throw new BadRequestException("Invalid order status: " + raw);
        }
        return ResponseEntity.ok(ApiResponse.ok("Order status updated",
                orderService.updateOrderStatus(id, status)));
    }

    @PutMapping("/{id}/payment-received")
    public ResponseEntity<ApiResponse<OrderDTO>> markPaymentReceived(
            @PathVariable Long id,
            @RequestBody(required = false) Map<String, String> body) {
        String transactionRef = body != null ? body.get("transactionRef") : null;
        return ResponseEntity.ok(ApiResponse.ok("Payment received",
                orderService.markPaymentReceived(id, transactionRef)));
    }

    @GetMapping("/{id}/invoice")
    public ResponseEntity<ApiResponse<InvoiceDTO>> getInvoice(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok("Invoice generated", invoiceService.getOrCreate(id)));
    }

    @GetMapping("/{id}/invoice/pdf")
    public ResponseEntity<byte[]> getInvoicePdf(@PathVariable Long id) {
        byte[] pdf = invoiceService.generatePdf(id);
        String filename = "invoice-" + invoiceService.getOrCreate(id).getInvoiceNumber() + ".pdf";
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + filename + "\"")
                .contentType(MediaType.APPLICATION_PDF)
                .body(pdf);
    }
}
