package com.freshmeat.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class ReviewDTO {

    private Long id;
    private Long userId;

    @NotNull(message = "Order id is required")
    private Long orderId;

    private String orderNumber;
    private String userEmail;
    private String customerName;
    private String status;

    @NotNull(message = "Rating is required")
    @Min(value = 1, message = "Rating must be at least 1")
    @Max(value = 5, message = "Rating must be at most 5")
    private Integer rating;

    @NotBlank(message = "Review comment is required")
    @Size(max = 1000, message = "Review must not exceed 1000 characters")
    private String comment;

    private String createdAt;
    private String updatedAt;
}