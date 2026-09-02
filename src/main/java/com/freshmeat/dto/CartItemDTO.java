package com.freshmeat.dto;

import lombok.Data;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

@Data
public class CartItemDTO {
    private Long id;
    private Long productId;
    private String productName;
    private String productImage;
    private String categoryName;
    private Integer quantity;
    private String cuttingOption;
    private BigDecimal unitPrice;
    private BigDecimal effectiveUnitPrice;
    private BigDecimal subtotal;
    private Integer availableStock;
    private boolean available;
}

@Data
class CartSummaryDTO {
    private int totalItems;
    private BigDecimal subtotal;
    private BigDecimal discount;
    private BigDecimal grandTotal;
    private List<CartItemDTO> items = new ArrayList<>();
}
