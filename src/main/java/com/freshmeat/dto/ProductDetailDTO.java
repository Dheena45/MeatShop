package com.freshmeat.dto;

import lombok.Data;

import java.math.BigDecimal;
import java.util.List;

@Data
public class ProductDetailDTO {
    private Long id;
    private String name;
    private String shortDescription;
    private String description;
    private BigDecimal pricePerKg;
    private BigDecimal discountPercent;
    private BigDecimal effectivePrice;
    private Integer stockQuantity;
    private Integer minOrderQty;
    private String imageUrl;
    private boolean available;
    private boolean freshToday;
    private BigDecimal avgRating;
    private Integer reviewCount;
    private Long categoryId;
    private String categoryName;
    private List<String> cuttingOptions;
    private List<ReviewDTO> reviews;
}
