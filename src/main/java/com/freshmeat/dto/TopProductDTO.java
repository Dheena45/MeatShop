package com.freshmeat.dto;

import lombok.Data;

@Data
public class TopProductDTO {
    private Long productId;
    private String productName;
    private long soldQuantity;
    private double revenue;
}