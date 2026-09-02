package com.freshmeat.dto;

import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
public class InventoryDTO {
    private Long productId;
    private String productName;
    private Long categoryId;
    private String categoryName;
    private Integer currentStock;
    private Integer minStock;
    private String stockStatus;
    private BigDecimal pricePerKg;
    private LocalDateTime lastRestockedAt;
}
