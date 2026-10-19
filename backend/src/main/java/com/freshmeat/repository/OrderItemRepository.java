package com.freshmeat.repository;

import com.freshmeat.entity.OrderItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;

public interface OrderItemRepository extends JpaRepository<OrderItem, Long> {

    List<OrderItem> findByOrderId(Long orderId);

    boolean existsByOrderIdAndProductId(Long orderId, Long productId);

    long countByProductId(Long productId);

    @Query("SELECT oi.product.id, oi.productName, SUM(oi.quantity) AS totalQty FROM OrderItem oi " +
           "GROUP BY oi.product.id, oi.productName ORDER BY totalQty DESC")
    List<Object[]> findTopSellingProducts();

    @Query("SELECT oi.product.category.name, COALESCE(SUM(oi.subtotal), 0) FROM OrderItem oi " +
           "GROUP BY oi.product.category.name")
    List<Object[]> findCategoryWiseSales();

    @Query("SELECT COUNT(oi) > 0 FROM OrderItem oi " +
           "JOIN oi.order o WHERE oi.product.id = :productId AND o.user.id = :userId " +
           "AND o.status = 'DELIVERED'")
    boolean hasPurchasedProduct(@Param("productId") Long productId, @Param("userId") Long userId);

    @Query("SELECT DISTINCT oi.product.id FROM OrderItem oi GROUP BY oi.product.id " +
           "ORDER BY SUM(oi.quantity) DESC")
    List<Long> findByOrderFrequency();

    @Query("SELECT oi.product.id, oi.productName, SUM(oi.quantity), COALESCE(SUM(oi.subtotal), 0) " +
           "FROM OrderItem oi JOIN oi.order o " +
           "WHERE o.status <> 'CANCELLED' AND o.createdAt >= :start AND o.createdAt < :end " +
           "GROUP BY oi.product.id, oi.productName ORDER BY SUM(oi.quantity) DESC")
    List<Object[]> findTopSellingProductsBetween(@Param("start") LocalDateTime start, @Param("end") LocalDateTime end);

    @Query("SELECT oi.product.category.name, COALESCE(SUM(oi.quantity), 0), COALESCE(SUM(oi.subtotal), 0) " +
           "FROM OrderItem oi JOIN oi.order o " +
           "WHERE o.status <> 'CANCELLED' AND o.createdAt >= :start AND o.createdAt < :end " +
           "GROUP BY oi.product.category.name")
    List<Object[]> findCategoryWiseSalesBetween(@Param("start") LocalDateTime start, @Param("end") LocalDateTime end);

    @Query("SELECT oi FROM OrderItem oi JOIN oi.order o " +
           "WHERE oi.product.id = :productId AND o.status <> 'PLACED' AND o.status <> 'CANCELLED' " +
           "AND o.createdAt >= :start AND o.createdAt < :end " +
           "ORDER BY o.createdAt DESC")
    List<OrderItem> findSalesItemsForProductBetween(@Param("productId") Long productId,
                                                    @Param("start") LocalDateTime start,
                                                    @Param("end") LocalDateTime end);

    @Query("SELECT COALESCE(SUM(oi.quantity), 0) FROM OrderItem oi JOIN oi.order o " +
           "WHERE o.status <> 'PLACED' AND o.status <> 'CANCELLED' " +
           "AND o.createdAt >= :start AND o.createdAt < :end")
    long sumQuantitySoldBetween(@Param("start") LocalDateTime start, @Param("end") LocalDateTime end);

    @Query("SELECT oi.order.orderNumber, oi.productName, oi.quantity FROM OrderItem oi JOIN oi.order o " +
           "WHERE o.status <> 'CANCELLED' AND o.createdAt >= :start AND o.createdAt < :end " +
           "ORDER BY oi.order.id ASC, oi.id ASC")
    List<Object[]> findContributingOrderItemsBetween(@Param("start") LocalDateTime start,
                                                     @Param("end") LocalDateTime end);
}
