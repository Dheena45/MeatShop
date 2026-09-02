package com.freshmeat.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class ReviewDTO {

    private Long id;
    private Long userId;

    @NotNull(message = "Product id is required")
    private Long productId;

    private String userEmail;

    @NotNull(message = "Rating is required")
    @Min(value = 1, message = "Rating must be at least 1")
    @Max(value = 5, message = "Rating must be at most 5")
    private Integer rating;

    private String comment;
    private String createdAt;
}
