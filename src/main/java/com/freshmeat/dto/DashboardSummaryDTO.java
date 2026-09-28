package com.freshmeat.dto;

import lombok.Data;

@Data
public class DashboardSummaryDTO {
    private double revenue;
    private long totalOrders;
    private long customers;
    private long activeCustomers;
    private long inactiveCustomers;
    private long newCustomers;
    private long totalProducts;
    private long inStock;
    private long lowStock;
    private long outOfStock;
}