package com.freshmeat.dto;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;

@Data
public class InventorySummaryDTO {
    private long totalProducts;
    private long inStock;
    private long lowStock;
    private long outOfStock;
    private List<InventoryItemDTO> lowStockItems = new ArrayList<>();
    private List<InventoryItemDTO> outOfStockItems = new ArrayList<>();
}