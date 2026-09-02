package com.freshmeat.repository;

import com.freshmeat.entity.Order;
import com.freshmeat.enums.OrderStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;

public interface OrderRepository extends JpaRepository<Order, Long> {

    List<Order> findByUserIdOrderByCreatedAtDesc(Long userId);

    boolean existsByOrderNumber(String orderNumber);

    List<Order> findByStatus(OrderStatus status);

    @Query("SELECT o FROM Order o WHERE o.user.id = :userId AND o.status = :status ORDER BY o.createdAt DESC")
    List<Order> findByUserIdAndStatus(@Param("userId") Long userId, @Param("status") OrderStatus status);

    @Query("SELECT o FROM Order o ORDER BY o.createdAt DESC")
    List<Order> findAllOrderByCreatedAtDesc();

    @Query("SELECT o FROM Order o WHERE (:status IS NULL OR o.status = :status) " +
           "AND (:keyword IS NULL OR LOWER(o.orderNumber) LIKE LOWER(CONCAT('%', :keyword, '%')) " +
           "OR LOWER(o.customerName) LIKE LOWER(CONCAT('%', :keyword, '%')) " +
           "OR LOWER(o.customerPhone) LIKE CONCAT('%', :keyword, '%')) " +
           "ORDER BY o.createdAt DESC")
    List<Order> search(@Param("status") OrderStatus status, @Param("keyword") String keyword);

    long countByCreatedAtBetween(LocalDateTime start, LocalDateTime end);

    @Query("SELECT COALESCE(SUM(o.grandTotal), 0) FROM Order o WHERE o.createdAt BETWEEN :start AND :end " +
           "AND o.status <> 'CANCELLED'")
    Double sumRevenueBetween(@Param("start") LocalDateTime start, @Param("end") LocalDateTime end);

    @Query("SELECT COALESCE(SUM(o.grandTotal), 0) FROM Order o WHERE o.status = 'DELIVERED'")
    Double sumDeliveredRevenue();

    @Query("SELECT COALESCE(SUM(o.grandTotal), 0) FROM Order o " +
           "WHERE o.createdAt BETWEEN :start AND :end AND o.status <> 'CANCELLED'")
    Double sumRevenue(@Param("start") LocalDateTime start, @Param("end") LocalDateTime end);
}
