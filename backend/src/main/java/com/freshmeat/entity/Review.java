package com.freshmeat.entity;

import com.freshmeat.enums.ReviewStatus;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.annotation.AccessType;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.DBRef;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

@Document(collection = "reviews")
@AccessType(AccessType.Type.FIELD)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class Review {

    @Id
    private Long id;

    /** Plain copy of {@link #user}'s id — what the "my reviews" queries filter on. */
    @Indexed(name = "idx_reviews_user")
    private Long userId;

    @DBRef(lazy = true)
    private User user;

    /**
     * Plain copy of {@link #order}'s id — one review per order, enforced with
     * {@code existsByOrderId} at insert time (a Mongo unique index cannot back
     * this: reviews without an order would collide on a missing field).
     */
    @Indexed(name = "idx_reviews_order")
    private Long orderId;

    @DBRef(lazy = true)
    private Order order;

    private String comment;

    private Integer rating;

    @Indexed(name = "idx_reviews_status")
    private ReviewStatus status;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    /** Keeps the plain {@link #userId} in sync with the object reference. */
    public void setUser(User user) {
        this.user = user;
        this.userId = user == null ? null : user.getId();
    }

    /** Keeps the plain {@link #orderId} in sync with the object reference. */
    public void setOrder(Order order) {
        this.order = order;
        this.orderId = order == null ? null : order.getId();
    }
}
