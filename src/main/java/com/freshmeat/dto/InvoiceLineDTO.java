package com.freshmeat.dto;

import lombok.Data;

import java.math.BigDecimal;

@Data
public class InvoiceLineDTO {
    private String productName;
    private String cuttingOption;
    private String unit;
    private BigDecimal quantity;
    private BigDecimal pricePerKg;
    private BigDecimal discount;
    private BigDecimal subtotal;
}