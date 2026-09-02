package com.freshmeat.repository;

import com.freshmeat.entity.CartItem;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface CartItemRepository extends JpaRepository<CartItem, Long> {

    List<CartItem> findByCartIdOrderByCreatedAtAsc(Long cartId);

    Optional<CartItem> findByCartIdAndId(Long cartId, Long itemId);

    Optional<CartItem> findByCartIdAndProductId(Long cartId, Long productId);

    void deleteByCartId(Long cartId);

    long countByCartId(Long cartId);
}
