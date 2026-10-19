package com.freshmeat.controller.admin;

import com.freshmeat.dto.ReviewDTO;
import com.freshmeat.enums.ReviewStatus;
import com.freshmeat.exception.ApiResponse;
import com.freshmeat.exception.BadRequestException;
import com.freshmeat.service.ReviewService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin/reviews")
public class AdminReviewController {

    @Autowired
    private ReviewService reviewService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<ReviewDTO>>> getReviews(
            @RequestParam(required = false) ReviewStatus status) {
        return ResponseEntity.ok(ApiResponse.ok(reviewService.adminGetAll(status)));
    }

    @PutMapping("/{id}/status")
    public ResponseEntity<ApiResponse<ReviewDTO>> updateStatus(@PathVariable Long id,
                                                               @RequestBody Map<String, String> body) {
        String raw = body != null ? body.get("status") : null;
        if (raw == null || raw.trim().isEmpty()) {
            throw new BadRequestException("Review status is required");
        }
        ReviewStatus status;
        try {
            status = ReviewStatus.valueOf(raw);
        } catch (IllegalArgumentException ex) {
            throw new BadRequestException("Invalid review status: " + raw);
        }
        return ResponseEntity.ok(ApiResponse.ok("Review status updated",
                reviewService.adminUpdateStatus(id, status)));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> deleteReview(@PathVariable Long id) {
        reviewService.adminDelete(id);
        return ResponseEntity.ok(ApiResponse.ok("Review deleted", null));
    }
}