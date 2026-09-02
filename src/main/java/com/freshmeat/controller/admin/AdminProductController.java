package com.freshmeat.controller.admin;

import com.freshmeat.dto.ProductDTO;
import com.freshmeat.exception.ApiResponse;
import com.freshmeat.service.ProductService;
import jakarta.validation.Valid;
import lombok.Data;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/admin/products")
public class AdminProductController {

    @Autowired
    private ProductService productService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<ProductDTO>>> getAllProducts(
            @RequestParam(required = false) String search) {
        List<ProductDTO> all = productService.searchProducts(
                        search == null ? "" : search, null, null, null, null, null, "newest", 0, 1000)
                .getContent();
        return ResponseEntity.ok(ApiResponse.ok(all));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<ProductDTO>> createProduct(@Valid @RequestBody ProductDTO dto) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok("Product created", productService.createProduct(dto)));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<ProductDTO>> updateProduct(@PathVariable Long id,
                                                                 @Valid @RequestBody ProductDTO dto) {
        return ResponseEntity.ok(ApiResponse.ok("Product updated", productService.updateProduct(id, dto)));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> deleteProduct(@PathVariable Long id) {
        productService.deleteProduct(id);
        return ResponseEntity.ok(ApiResponse.ok("Product deleted", null));
    }

    @PutMapping("/{id}/toggle")
    public ResponseEntity<ApiResponse<Void>> toggleProduct(@PathVariable Long id) {
        productService.toggleProduct(id);
        return ResponseEntity.ok(ApiResponse.ok("Product status updated", null));
    }

    @PutMapping("/{id}/stock")
    public ResponseEntity<ApiResponse<Void>> updateStock(@PathVariable Long id,
                                                         @RequestBody StockUpdateRequest request) {
        productService.updateStock(id, request.getQuantity());
        return ResponseEntity.ok(ApiResponse.ok("Stock updated", null));
    }
}

@Data
class StockUpdateRequest {
    private Integer quantity;
}
