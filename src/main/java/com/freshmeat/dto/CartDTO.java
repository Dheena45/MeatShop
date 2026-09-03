package com.freshmeat.dto;

import lombok.Data;

import java.math.BigDecimal;
import java.util.List;

@Data
public class CartDTO {
    private Long cartId;
    private int totalItems;
    private BigDecimal subtotal;
    private BigDecimal discount;
    private BigDecimal deliveryCharge;
    private BigDecimal grandTotal;
    private List<CartItemDTO> items;
}
