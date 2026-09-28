package com.freshmeat.repository;

import com.freshmeat.entity.Review;
import com.freshmeat.enums.ReviewStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ReviewRepository extends JpaRepository<Review, Long> {

    List<Review> findByUserId(Long userId);

    List<Review> findByUserIdOrderByCreatedAtDesc(Long userId);

    void deleteByUserId(Long userId);

    boolean existsByUserId(Long userId);

    boolean existsByOrderId(Long orderId);

    void deleteByOrderId(Long orderId);

    List<Review> findByStatusOrderByCreatedAtDesc(ReviewStatus status);

    List<Review> findByStatusIsNullOrderByCreatedAtDesc();

    List<Review> findTop6ByOrderByCreatedAtDesc();
}