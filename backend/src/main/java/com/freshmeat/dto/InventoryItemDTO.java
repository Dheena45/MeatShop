package com.freshmeat.dto;

import lombok.Data;

@Data
public class InventoryItemDTO {
    private Long productId;
    private String productName;
    private int stockQuantity;
}