package com.freshmeat.repository;

import com.freshmeat.entity.OrderItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

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
}
