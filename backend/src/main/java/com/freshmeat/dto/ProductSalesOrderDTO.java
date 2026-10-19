package com.freshmeat.dto;

import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
public class ProductSalesOrderDTO {
    private String orderNumber;
    private double quantity;
    private BigDecimal amount;
    private LocalDateTime orderDate;
    private String status;
}