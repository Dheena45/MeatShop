package com.freshmeat.repository;

import com.freshmeat.entity.Cart;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.Optional;

public interface CartRepository extends MongoRepository<Cart, Long> {

    Optional<Cart> findByUserId(Long userId);
}
