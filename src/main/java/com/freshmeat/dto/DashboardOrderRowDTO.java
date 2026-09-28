package com.freshmeat.dto;

import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Data
public class DashboardOrderRowDTO {
    private String orderNumber;
    private String customerName;
    private LocalDateTime createdAt;
    private BigDecimal grandTotal;
    private String status;
    private List<MonthlyOrderItemDTO> items;
}