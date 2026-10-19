package com.freshmeat.dto;

import lombok.Data;

import java.math.BigDecimal;

@Data
public class OrderLineDTO {
    private Long id;
    private Long productId;
    private String productName;
    private String productImage;
    private Integer quantity;
    private String cuttingOption;
    private BigDecimal pricePerKg;
    private BigDecimal subtotal;
}
