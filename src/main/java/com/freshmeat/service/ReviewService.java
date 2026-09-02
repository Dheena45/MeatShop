package com.freshmeat.service;

import com.freshmeat.dto.ReviewDTO;
import com.freshmeat.entity.Product;
import com.freshmeat.entity.Review;
import com.freshmeat.entity.User;
import com.freshmeat.exception.BadRequestException;
import com.freshmeat.exception.ResourceNotFoundException;
import com.freshmeat.repository.ProductRepository;
import com.freshmeat.repository.ReviewRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class ReviewService {

    @Autowired
    private ReviewRepository reviewRepository;

    @Autowired
    private ProductRepository productRepository;

    @Autowired
    private AuthService authService;

    @Autowired
    private OrderService orderService;

    @Transactional
    public ReviewDTO addReview(ReviewDTO request) {
        User user = authService.getCurrentUser();

        if (!orderService.userPurchasedProduct(user.getId(), request.getProductId())) {
            throw new BadRequestException("You can only review a product you have purchased and received");
        }

        if (reviewRepository.existsByUserIdAndProductId(user.getId(), request.getProductId())) {
            throw new BadRequestException("You have already reviewed this product");
        }

        Product product = productRepository.findById(request.getProductId())
                .orElseThrow(() -> new ResourceNotFoundException("Product not found"));

        Review review = new Review();
        review.setUser(user);
        review.setProduct(product);
        review.setRating(request.getRating());
        review.setComment(request.getComment());
        review = reviewRepository.save(review);

        updateProductRating(product);

        return toDTO(review);
    }

    private void updateProductRating(Product product) {
        Double avg = reviewRepository.averageRatingForProduct(product.getId());
        long count = reviewRepository.countByProductId(product.getId());
        product.setAvgRating(BigDecimal.valueOf(avg).setScale(2, RoundingMode.HALF_UP));
        product.setReviewCount((int) count);
        productRepository.save(product);
    }

    public List<ReviewDTO> getProductReviews(Long productId) {
        return reviewRepository.findByProductIdOrderByCreatedAtDesc(productId)
                .stream().map(this::toDTO).collect(Collectors.toList());
    }

    public List<ReviewDTO> getRecentReviews() {
        return reviewRepository.findTop6ByOrderByCreatedAtDesc()
                .stream().map(this::toDTO).collect(Collectors.toList());
    }

    private ReviewDTO toDTO(Review review) {
        ReviewDTO dto = new ReviewDTO();
        dto.setId(review.getId());
        dto.setUserId(review.getUser() != null ? review.getUser().getId() : null);
        dto.setProductId(review.getProduct() != null ? review.getProduct().getId() : null);
        dto.setUserEmail(review.getUser() != null ? maskName(review.getUser().getName()) : "Anonymous");
        dto.setRating(review.getRating());
        dto.setComment(review.getComment());
        dto.setCreatedAt(review.getCreatedAt() != null ? review.getCreatedAt().toString() : null);
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
}
