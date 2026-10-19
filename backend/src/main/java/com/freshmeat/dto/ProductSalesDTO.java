package com.freshmeat.dto;

import lombok.Data;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Data
public class ProductSalesDTO {
    private Long productId;
    private String productName;
    private String categoryName;
    private LocalDate lastSoldDate;
    private long totalQuantitySold;
    private long totalOrders;
    private double totalSalesAmount;
    private double averageSellingPrice;
    private int currentStock;
    private String unit;
    private double discountPercent;
    private boolean available;
    private List<ProductSalesOrderDTO> recentOrders = new ArrayList<>();
}