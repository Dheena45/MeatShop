package com.freshmeat.controller.admin;

import com.freshmeat.dto.InventoryDTO;
import com.freshmeat.entity.Inventory;
import com.freshmeat.entity.Product;
import com.freshmeat.enums.StockStatus;
import com.freshmeat.exception.ApiResponse;
import com.freshmeat.exception.ResourceNotFoundException;
import com.freshmeat.repository.InventoryRepository;
import com.freshmeat.repository.ProductRepository;
import lombok.Data;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;
import java.util.stream.Stream;

@RestController
@RequestMapping("/api/admin/inventory")
public class AdminInventoryController {

    @Autowired
    private InventoryRepository inventoryRepository;

    @Autowired
    private ProductRepository productRepository;

    @GetMapping
    public ResponseEntity<ApiResponse<List<InventoryDTO>>> getInventory() {
        List<Inventory> inventoryList = inventoryRepository.findAll();
        List<InventoryDTO> result = inventoryList.stream()
                .map(this::toDTO)
                .sorted(Comparator.comparing(InventoryDTO::getStockStatus)
                        .thenComparing(Comparator.comparing(InventoryDTO::getCurrentStock).reversed()))
                .collect(Collectors.toList());
        return ResponseEntity.ok(ApiResponse.ok(result));
    }

    @PutMapping("/{productId}")
    public ResponseEntity<ApiResponse<InventoryDTO>> updateInventory(@PathVariable Long productId,
                                                                     @RequestBody StockRequest request) {
        Product product = productRepository.findById(productId)
                .orElseThrow(() -> new ResourceNotFoundException("Product not found"));

        Optional<Inventory> existing = inventoryRepository.findByProductId(productId);
        Inventory inventory = existing.orElse(new Inventory());
        if (inventory.getProduct() == null) {
            inventory.setProduct(product);
        }
        inventory.setCurrentStock(request.getStock());
        if (request.getMinStock() != null) {
            inventory.setMinStock(request.getMinStock());
        }
        inventory.setLastRestockedAt(LocalDateTime.now());
        inventory = inventoryRepository.save(inventory);

        product.setStockQuantity(request.getStock());
        productRepository.save(product);

        return ResponseEntity.ok(ApiResponse.ok("Inventory updated", toDTO(inventory)));
    }

    private InventoryDTO toDTO(Inventory inventory) {
        Product product = inventory.getProduct();
        InventoryDTO dto = new InventoryDTO();
        dto.setProductId(product.getId());
        dto.setProductName(product.getName());
        dto.setCategoryId(product.getCategory() != null ? product.getCategory().getId() : null);
        dto.setCategoryName(product.getCategory() != null ? product.getCategory().getName() : "");
        dto.setCurrentStock(inventory.getCurrentStock());
        dto.setMinStock(inventory.getMinStock());
        dto.setStockStatus(getStockStatus(inventory.getCurrentStock(), inventory.getMinStock()));
        dto.setPricePerKg(product.getPricePerKg());
        dto.setLastRestockedAt(inventory.getLastRestockedAt());
        return dto;
    }

    private String getStockStatus(int currentStock, int minStock) {
        if (currentStock <= 0) return StockStatus.OUT_OF_STOCK.name();
        if (currentStock <= minStock) return StockStatus.LOW_STOCK.name();
        return StockStatus.IN_STOCK.name();
    }
}

@Data
class StockRequest {
    private Integer stock;
    private Integer minStock;
}
