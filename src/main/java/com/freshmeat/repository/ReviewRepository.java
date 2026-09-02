package com.freshmeat.repository;

import com.freshmeat.entity.Review;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface ReviewRepository extends JpaRepository<Review, Long> {

    List<Review> findByProductIdOrderByCreatedAtDesc(Long productId);

    List<Review> findByUserId(Long userId);

    boolean existsByUserIdAndProductId(Long userId, Long productId);

    long countByProductId(Long productId);

    @Query("SELECT COALESCE(AVG(r.rating), 0) FROM Review r WHERE r.product.id = :productId")
    Double averageRatingForProduct(@Param("productId") Long productId);

    List<Review> findTop6ByOrderByCreatedAtDesc();
}
