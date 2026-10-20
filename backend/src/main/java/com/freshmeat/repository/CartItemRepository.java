package com.freshmeat.repository;

import com.freshmeat.entity.CartItem;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

/**
 * Every method is a plain derived query: the cart is referenced by a stored
 * {@code cartId}, so no join is needed. The two {@code deleteBy...} methods are
 * derived deletes (find then remove), which replace the old bulk
 * {@code @Modifying} JPQL deletes.
 */
public interface CartItemRepository extends MongoRepository<CartItem, Long> {

    List<CartItem> findByCartIdOrderByCreatedAtAsc(Long cartId);

    Optional<CartItem> findByCartIdAndId(Long cartId, Long itemId);

    Optional<CartItem> findByCartIdAndProductId(Long cartId, Long productId);

    void deleteByCartId(Long cartId);

    void deleteByProductId(Long productId);

    long countByCartId(Long cartId);
}
