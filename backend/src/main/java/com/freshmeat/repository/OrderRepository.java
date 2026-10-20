package com.freshmeat.repository;

import com.freshmeat.entity.Order;
import com.freshmeat.enums.OrderStatus;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Derived queries where a stored field is enough; the reporting and
 * delivery-board queries live in {@link OrderRepositoryCustom}.
 * <p>
 * {@code findAllOrderByCreatedAtDesc} keeps its old method name but is backed by
 * an explicit query with a sort, because Mongo's query derivation needs a
 * predicate part to hang an {@code OrderBy} clause on.
 */
public interface OrderRepository extends MongoRepository<Order, Long>, OrderRepositoryCustom {

    List<Order> findByUserIdOrderByCreatedAtDesc(Long userId);

    boolean existsByUserId(Long userId);

    boolean existsByOrderNumber(String orderNumber);

    List<Order> findByStatus(OrderStatus status);

    List<Order> findByUserIdAndStatusOrderByCreatedAtDesc(Long userId, OrderStatus status);

    @Query(value = "{}", sort = "{ 'createdAt': -1 }")
    List<Order> findAllOrderByCreatedAtDesc();

    long countByCreatedAtBetween(LocalDateTime start, LocalDateTime end);

    long countByStatusNot(OrderStatus status);
}
