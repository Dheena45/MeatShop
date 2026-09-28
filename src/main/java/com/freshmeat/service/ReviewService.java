package com.freshmeat.service;

import com.freshmeat.dto.ReviewDTO;
import com.freshmeat.entity.Order;
import com.freshmeat.entity.Review;
import com.freshmeat.entity.User;
import com.freshmeat.enums.OrderStatus;
import com.freshmeat.enums.ReviewStatus;
import com.freshmeat.exception.BadRequestException;
import com.freshmeat.exception.ResourceNotFoundException;
import com.freshmeat.exception.UnauthorizedException;
import com.freshmeat.repository.OrderRepository;
import com.freshmeat.repository.ReviewRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class ReviewService {

    private static final int MAX_COMMENT_LENGTH = 1000;

    @Autowired
    private ReviewRepository reviewRepository;

    @Autowired
    private OrderRepository orderRepository;

    @Autowired
    private AuthService authService;

    @Transactional
    public ReviewDTO addReview(ReviewDTO request) {
        User user = authService.getCurrentUser();

        if (request.getOrderId() == null) {
            throw new BadRequestException("Order id is required");
        }

        Order order = orderRepository.findById(request.getOrderId())
                .orElseThrow(() -> new ResourceNotFoundException("Order not found"));

        if (!order.getUser().getId().equals(user.getId())) {
            throw new UnauthorizedException("You do not have access to this order");
        }

        if (order.getStatus() != OrderStatus.DELIVERED) {
            throw new BadRequestException("You can review an order only after it has been delivered");
        }

        if (reviewRepository.existsByOrderId(order.getId())) {
            throw new BadRequestException("You have already reviewed this order.");
        }

        if (request.getRating() == null || request.getRating() < 1 || request.getRating() > 5) {
            throw new BadRequestException("Rating must be between 1 and 5");
        }

        String comment = request.getComment() != null ? request.getComment().trim() : "";
        if (comment.isEmpty()) {
            throw new BadRequestException("Review comment is required");
        }
        if (comment.length() > MAX_COMMENT_LENGTH) {
            throw new BadRequestException("Review must not exceed 1000 characters");
        }

        Review review = new Review();
        review.setUser(user);
        review.setOrder(order);
        review.setRating(request.getRating());
        review.setComment(comment);
        review.setStatus(ReviewStatus.APPROVED);
        review = reviewRepository.save(review);

        return toDTO(review);
    }

    public List<ReviewDTO> getPublicReviews() {
        List<Review> reviews = new ArrayList<>(
                reviewRepository.findByStatusOrderByCreatedAtDesc(ReviewStatus.APPROVED));
        reviews.addAll(reviewRepository.findByStatusIsNullOrderByCreatedAtDesc());
        reviews.sort(Comparator.comparing(Review::getCreatedAt,
                Comparator.nullsLast(Comparator.reverseOrder())));
        return reviews.stream().limit(6).map(this::toDTO).collect(Collectors.toList());
    }

    public List<ReviewDTO> getMyReviews(Long userId) {
        return reviewRepository.findByUserIdOrderByCreatedAtDesc(userId)
                .stream().map(this::toDTO).collect(Collectors.toList());
    }

    public List<ReviewDTO> getRecentReviews() {
        return getPublicReviews();
    }

    public List<ReviewDTO> adminGetAll(ReviewStatus status) {
        List<Review> reviews;
        if (status == null) {
            reviews = reviewRepository.findAll();
            reviews.sort(Comparator.comparing(Review::getCreatedAt,
                    Comparator.nullsLast(Comparator.reverseOrder())));
        } else if (status == ReviewStatus.APPROVED) {
            reviews = new ArrayList<>(
                    reviewRepository.findByStatusOrderByCreatedAtDesc(status));
            reviews.addAll(reviewRepository.findByStatusIsNullOrderByCreatedAtDesc());
            reviews.sort(Comparator.comparing(Review::getCreatedAt,
                    Comparator.nullsLast(Comparator.reverseOrder())));
        } else {
            reviews = reviewRepository.findByStatusOrderByCreatedAtDesc(status);
        }
        return reviews.stream().map(this::toDTO).collect(Collectors.toList());
    }

    @Transactional
    public ReviewDTO adminUpdateStatus(Long reviewId, ReviewStatus status) {
        Review review = reviewRepository.findById(reviewId)
                .orElseThrow(() -> new ResourceNotFoundException("Review not found"));
        review.setStatus(status);
        return toDTO(reviewRepository.save(review));
    }

    @Transactional
    public void adminDelete(Long reviewId) {
        Review review = reviewRepository.findById(reviewId)
                .orElseThrow(() -> new ResourceNotFoundException("Review not found"));
        reviewRepository.delete(review);
    }

    private ReviewDTO toDTO(Review review) {
        ReviewDTO dto = new ReviewDTO();
        dto.setId(review.getId());
        dto.setUserId(review.getUser() != null ? review.getUser().getId() : null);
        dto.setOrderId(review.getOrder() != null ? review.getOrder().getId() : null);
        dto.setOrderNumber(review.getOrder() != null ? review.getOrder().getOrderNumber() : null);
        dto.setUserEmail(review.getUser() != null ? maskName(review.getUser().getName()) : "Anonymous");
        dto.setCustomerName(review.getUser() != null ? displayName(review.getUser().getName()) : "FreshMeat User");
        dto.setStatus(review.getStatus() != null ? review.getStatus().name() : ReviewStatus.APPROVED.name());
        dto.setRating(review.getRating());
        dto.setComment(review.getComment());
        dto.setCreatedAt(review.getCreatedAt() != null ? review.getCreatedAt().toString() : null);
        dto.setUpdatedAt(review.getUpdatedAt() != null ? review.getUpdatedAt().toString() : null);
        return dto;
    }

    private String maskName(String name) {
        if (name == null || name.isBlank()) return "Anonymous";
        String[] parts = name.trim().split("\\s+");
        if (parts.length == 1) {
            return parts[0].charAt(0) + "***";
        }
        return parts[0] + " " + parts[1].charAt(0) + "***";
    }

    private String displayName(String name) {
        if (name == null || name.isBlank()) return "FreshMeat User";
        return name.trim();
    }
}