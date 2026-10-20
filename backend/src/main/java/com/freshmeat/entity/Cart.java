package com.freshmeat.entity;

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

/**
 * MongoDB document. One cart per user is enforced by the same unique index
 * the MySQL schema had ({@code idx_cart_user}); the user itself is a plain
 * {@code userId} plus a lazy DBRef, kept in sync by the custom setter.
 */
@Document(collection = "cart")
@AccessType(AccessType.Type.FIELD)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class Cart {

    @Id
    private Long id;

    /** Plain copy of {@link #user}'s id — {@code findByUserId} uses it directly. */
    @Indexed(name = "idx_cart_user", unique = true)
    private Long userId;

    @DBRef(lazy = true)
    private User user;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    /** Keeps the plain {@link #userId} in sync with the object reference. */
    public void setUser(User user) {
        this.user = user;
        this.userId = user == null ? null : user.getId();
    }
}
