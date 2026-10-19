package com.freshmeat.dto;

import lombok.Data;

@Data
public class YearlySummaryDTO {
    private double totalSales;
    private long totalOrders;
    private double averageOrderValue;
    private long totalItemsSold;

    private long confirmedOrders;
    private long preparingOrders;
    private long outForDeliveryOrders;
    private long deliveredOrders;
    private long cancelledOrders;

    private long totalCustomers;
    private long newCustomers;
    private long activeCustomers;
    private long inactiveCustomers;

    private long totalProducts;
    private long activeProducts;
    private long inactiveProducts;
    private long lowStockProducts;
    private long outOfStockProducts;

    private String bestSellingProduct;
    private String topCategory;
    private double highestOrderValue;
}