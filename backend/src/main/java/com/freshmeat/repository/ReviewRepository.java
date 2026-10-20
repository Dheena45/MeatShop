package com.freshmeat.repository;

import com.freshmeat.entity.Review;
import com.freshmeat.enums.ReviewStatus;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

/**
 * All methods are derived queries on stored fields ({@code userId},
 * {@code orderId}, {@code status}); the two {@code deleteBy...} methods are
 * derived deletes.
 * <p>
 * {@code status} may be null for reviews that predate approval, hence the
 * explicit {@code findByStatusIsNull...} used by the moderation list.
 */
public interface ReviewRepository extends MongoRepository<Review, Long> {

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
