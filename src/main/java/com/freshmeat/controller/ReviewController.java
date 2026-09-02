package com.freshmeat.controller;

import com.freshmeat.dto.ReviewDTO;
import com.freshmeat.exception.ApiResponse;
import com.freshmeat.service.ReviewService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/reviews")
public class ReviewController {

    @Autowired
    private ReviewService reviewService;

    @PostMapping
    public ResponseEntity<ApiResponse<ReviewDTO>> addReview(@Valid @RequestBody ReviewDTO request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok("Review submitted", reviewService.addReview(request)));
    }

    @GetMapping("/product/{productId}")
    public ResponseEntity<ApiResponse<List<ReviewDTO>>> getProductReviews(@PathVariable Long productId) {
        return ResponseEntity.ok(ApiResponse.ok(reviewService.getProductReviews(productId)));
    }

    @GetMapping("/recent")
    public ResponseEntity<ApiResponse<List<ReviewDTO>>> getRecent() {
        return ResponseEntity.ok(ApiResponse.ok(reviewService.getRecentReviews()));
    }
}
