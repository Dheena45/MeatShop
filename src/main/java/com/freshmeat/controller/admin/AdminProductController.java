package com.freshmeat.controller.admin;

import com.freshmeat.dto.ProductDTO;
import com.freshmeat.exception.ApiResponse;
import com.freshmeat.service.FileStorageService;
import com.freshmeat.service.ProductService;
import lombok.Data;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.math.BigDecimal;
import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/admin/products")
public class AdminProductController {

    @Autowired
    private ProductService productService;

    @Autowired
    private FileStorageService fileStorageService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<ProductDTO>>> getAllProducts(
            @RequestParam(required = false) String search) {
        List<ProductDTO> all = productService.searchProducts(
                        search == null ? "" : search, null, null, null, null, null, "newest", 0, 1000)
                .getContent();
        return ResponseEntity.ok(ApiResponse.ok(all));
    }

    @PostMapping(consumes = "multipart/form-data")
    public ResponseEntity<ApiResponse<ProductDTO>> createProduct(
            @RequestParam("name") String name,
            @RequestParam(value = "shortDescription", required = false) String shortDescription,
            @RequestParam(value = "description", required = false) String description,
            @RequestParam("pricePerKg") BigDecimal pricePerKg,
            @RequestParam(value = "discountPercent", defaultValue = "0") BigDecimal discountPercent,
            @RequestParam("stockQuantity") Integer stockQuantity,
            @RequestParam(value = "minOrderQty", defaultValue = "1") Integer minOrderQty,
            @RequestParam(value = "available", defaultValue = "true") boolean available,
            @RequestParam(value = "freshToday", defaultValue = "true") boolean freshToday,
            @RequestParam("categoryId") Long categoryId,
            @RequestParam(value = "cuttingOptions", required = false) String cuttingOptions,
            @RequestParam(value = "image", required = false) MultipartFile image) {

        ProductDTO dto = buildDTO(name, shortDescription, description, pricePerKg, discountPercent,
                stockQuantity, minOrderQty, available, freshToday, categoryId, cuttingOptions, null);

        if (image != null && !image.isEmpty()) {
            dto.setImageUrl(fileStorageService.storeImage(image));
        }
        if (dto.getImageUrl() == null || dto.getImageUrl().isBlank()) {
            dto.setImageUrl("/images/default-meat.jpg");
        }

        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok("Product created", productService.createProduct(dto)));
    }

    @PutMapping(value = "/{id}", consumes = "multipart/form-data")
    public ResponseEntity<ApiResponse<ProductDTO>> updateProduct(
            @PathVariable Long id,
            @RequestParam("name") String name,
            @RequestParam(value = "shortDescription", required = false) String shortDescription,
            @RequestParam(value = "description", required = false) String description,
            @RequestParam("pricePerKg") BigDecimal pricePerKg,
            @RequestParam(value = "discountPercent", defaultValue = "0") BigDecimal discountPercent,
            @RequestParam("stockQuantity") Integer stockQuantity,
            @RequestParam(value = "minOrderQty", defaultValue = "1") Integer minOrderQty,
            @RequestParam(value = "available", defaultValue = "true") boolean available,
            @RequestParam(value = "freshToday", defaultValue = "true") boolean freshToday,
            @RequestParam("categoryId") Long categoryId,
            @RequestParam(value = "cuttingOptions", required = false) String cuttingOptions,
            @RequestParam(value = "image", required = false) MultipartFile image) {

        ProductDTO existing = productService.getAdminProduct(id);
        ProductDTO dto = buildDTO(name, shortDescription, description, pricePerKg, discountPercent,
                stockQuantity, minOrderQty, available, freshToday, categoryId, cuttingOptions,
                existing.getImageUrl());

        // Replace image only when a new one is provided
        if (image != null && !image.isEmpty()) {
            String oldImageUrl = dto.getImageUrl();
            String newImageUrl = fileStorageService.storeImage(image);
            dto.setImageUrl(newImageUrl);
            if (oldImageUrl != null && !oldImageUrl.equals(newImageUrl)) {
                // Delete the old uploaded file only after the new one was saved
                fileStorageService.deleteUploadedFile(oldImageUrl);
            }
        }
        if (dto.getImageUrl() == null || dto.getImageUrl().isBlank()) {
            dto.setImageUrl("/images/default-meat.jpg");
        }

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

    private ProductDTO buildDTO(String name, String shortDescription, String description,
                                BigDecimal pricePerKg, BigDecimal discountPercent,
                                Integer stockQuantity, Integer minOrderQty,
                                boolean available, boolean freshToday, Long categoryId,
                                String cuttingOptions, String existingImageUrl) {
        ProductDTO dto = new ProductDTO();
        dto.setName(name);
        dto.setShortDescription(shortDescription);
        dto.setDescription(description);
        dto.setPricePerKg(pricePerKg);
        dto.setDiscountPercent(discountPercent == null ? BigDecimal.ZERO : discountPercent);
        dto.setStockQuantity(stockQuantity);
        dto.setMinOrderQty(minOrderQty == null ? 1 : minOrderQty);
        dto.setAvailable(available);
        dto.setFreshToday(freshToday);
        dto.setCategoryId(categoryId);
        dto.setImageUrl(existingImageUrl);
        if (cuttingOptions != null && !cuttingOptions.isBlank()) {
            List<String> options = Arrays.stream(cuttingOptions.split(","))
                    .map(String::trim)
                    .map(String::toUpperCase)
                    .filter(s -> !s.isEmpty())
                    .collect(Collectors.toList());
            dto.setCuttingOptions(options);
        }
        return dto;
    }
}

@Data
class StockUpdateRequest {
    private Integer quantity;
}
