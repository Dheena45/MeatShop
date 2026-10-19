package com.freshmeat.controller;

import com.freshmeat.dto.InvoiceDTO;
import com.freshmeat.dto.OrderDTO;
import com.freshmeat.dto.OrderRequest;
import com.freshmeat.exception.ApiResponse;
import com.freshmeat.service.InvoiceService;
import com.freshmeat.service.OrderService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/orders")
public class OrderController {

    @Autowired
    private OrderService orderService;

    @Autowired
    private InvoiceService invoiceService;

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

    /**
     * Reports the outcome of an online payment from the (demo) payment gateway.
     * Only reached by the authenticated customer who owns the order — it is the
     * only way an online payment moves PENDING -> PAID/FAILED.
     */
    @PostMapping("/{id}/payment/confirm")
    public ResponseEntity<ApiResponse<OrderDTO>> confirmOnlinePayment(
            @PathVariable Long id,
            @RequestBody(required = false) Map<String, Object> body) {
        boolean success = body != null && Boolean.TRUE.equals(body.get("success"));
        String transactionRef = (body != null && body.get("transactionRef") != null)
                ? String.valueOf(body.get("transactionRef")) : null;
        return ResponseEntity.ok(ApiResponse.ok(
                success ? "Payment completed successfully" : "Payment failed",
                orderService.confirmOnlinePayment(id, success, transactionRef)));
    }

    @GetMapping("/{id}/invoice")
    public ResponseEntity<ApiResponse<InvoiceDTO>> getMyInvoice(@PathVariable Long id) {
        orderService.getOrderForUser(id);
        return ResponseEntity.ok(ApiResponse.ok("Invoice retrieved", invoiceService.getOrCreate(id)));
    }

    @GetMapping("/{id}/invoice/pdf")
    public ResponseEntity<byte[]> getMyInvoicePdf(@PathVariable Long id) {
        orderService.getOrderForUser(id);
        byte[] pdf = invoiceService.generatePdf(id);
        String filename = "invoice-" + invoiceService.getOrCreate(id).getInvoiceNumber() + ".pdf";
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + filename + "\"")
                .contentType(MediaType.APPLICATION_PDF)
                .body(pdf);
    }
}
