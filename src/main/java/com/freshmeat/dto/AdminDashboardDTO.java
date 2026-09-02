package com.freshmeat.dto;

import lombok.Data;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Data
public class AdminDashboardDTO {
    private long totalCustomers;
    private long totalProducts;
    private long totalOrders;
    private long todaysOrders;
    private double todaysRevenue;
    private double monthlyRevenue;
    private long lowStockProducts;

    private List<Map<String, Object>> monthlySales = new ArrayList<>();
    private List<Map<String, Object>> orderStatusDistribution = new ArrayList<>();
    private List<Map<String, Object>> topSellingProducts = new ArrayList<>();
    private List<Map<String, Object>> categoryWiseSales = new ArrayList<>();
}
