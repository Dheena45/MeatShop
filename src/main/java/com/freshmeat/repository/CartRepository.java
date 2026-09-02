package com.freshmeat.repository;

import com.freshmeat.entity.Cart;
import com.freshmeat.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface CartRepository extends JpaRepository<Cart, Long> {

    Optional<Cart> findByUserId(Long userId);

    Optional<Cart> findByUser(User user);
}
