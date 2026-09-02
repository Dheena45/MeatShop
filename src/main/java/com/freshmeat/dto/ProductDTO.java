package com.freshmeat.dto;

import lombok.Data;

import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.util.List;

@Data
public class ProductDTO {

    private Long id;

    @NotBlank(message = "Product name is required")
    @Size(max = 150)
    private String name;

    @Size(max = 40)
    private String shortDescription;

    private String description;

    @NotNull(message = "Price per kg is required")
    @Positive(message = "Price must be positive")
    private BigDecimal pricePerKg;

    private BigDecimal discountPercent = BigDecimal.ZERO;

    @NotNull(message = "Stock quantity is required")
    @Min(value = 0, message = "Stock cannot be negative")
    private Integer stockQuantity;

    @Min(value = 1, message = "Min order quantity must be at least 1")
    private Integer minOrderQty = 1;

    private String imageUrl;

    private Boolean available = true;

    private Boolean freshToday = true;

    private Long categoryId;

    private List<String> cuttingOptions;

    private BigDecimal avgRating;

    private Integer reviewCount;
}
