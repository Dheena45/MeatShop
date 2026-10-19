package com.freshmeat.controller;

import com.freshmeat.dto.ReviewDTO;
import com.freshmeat.exception.ApiResponse;
import com.freshmeat.service.AuthService;
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

    @Autowired
    private AuthService authService;

    @PostMapping
    public ResponseEntity<ApiResponse<ReviewDTO>> addReview(@Valid @RequestBody ReviewDTO request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok("Review submitted", reviewService.addReview(request)));
    }

    @GetMapping
    public ResponseEntity<ApiResponse<List<ReviewDTO>>> getPublicReviews() {
        return ResponseEntity.ok(ApiResponse.ok(reviewService.getPublicReviews()));
    }

    @GetMapping("/my-reviews")
    public ResponseEntity<ApiResponse<List<ReviewDTO>>> getMyReviews() {
        return ResponseEntity.ok(ApiResponse.ok(reviewService.getMyReviews(authService.getCurrentUser().getId())));
    }

    @GetMapping("/recent")
    public ResponseEntity<ApiResponse<List<ReviewDTO>>> getRecent() {
        return ResponseEntity.ok(ApiResponse.ok(reviewService.getRecentReviews()));
    }
}