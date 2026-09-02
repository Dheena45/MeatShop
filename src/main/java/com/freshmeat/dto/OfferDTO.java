package com.freshmeat.dto;

import lombok.Data;

import java.time.LocalDate;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;

@Data
public class OfferDTO {

    private Long id;

    @NotBlank(message = "Title is required")
    @Size(max = 150)
    private String title;

    @Size(max = 300)
    private String description;

    @NotNull(message = "Discount percent is required")
    private BigDecimal discountPercent;

    private String code;
    private Long productId;
    private Long categoryId;
    private LocalDate startDate;
    private LocalDate endDate;
    private Boolean active = true;
}
