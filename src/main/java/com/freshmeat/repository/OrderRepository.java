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

    boolean existsByUserId(Long userId);

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

    @Query("SELECT COUNT(o) FROM Order o WHERE o.createdAt BETWEEN :start AND :end")
    long countByCreatedAtBetween(@Param("start") LocalDateTime start, @Param("end") LocalDateTime end);

    @Query("SELECT COALESCE(SUM(o.grandTotal), 0) FROM Order o WHERE o.createdAt BETWEEN :start AND :end " +
           "AND o.status <> 'PLACED' AND o.status <> 'CANCELLED'")
    Double sumRevenueBetween(@Param("start") LocalDateTime start, @Param("end") LocalDateTime end);

    @Query("SELECT COALESCE(SUM(o.grandTotal), 0) FROM Order o WHERE o.status = 'DELIVERED'")
    Double sumDeliveredRevenue();

    @Query("SELECT COALESCE(SUM(o.grandTotal), 0) FROM Order o " +
           "WHERE o.createdAt BETWEEN :start AND :end AND o.status <> 'CANCELLED'")
    Double sumRevenue(@Param("start") LocalDateTime start, @Param("end") LocalDateTime end);

    @Query("SELECT o.status, COUNT(o) FROM Order o " +
           "WHERE o.createdAt >= :start AND o.createdAt < :end GROUP BY o.status")
    List<Object[]> countByStatusBetween(@Param("start") LocalDateTime start, @Param("end") LocalDateTime end);

    @Query("SELECT COUNT(o) FROM Order o " +
           "WHERE o.status <> 'CANCELLED' AND o.createdAt >= :start AND o.createdAt < :end")
    long countNonCancelledBetween(@Param("start") LocalDateTime start, @Param("end") LocalDateTime end);

    @Query("SELECT FUNCTION('YEAR', o.createdAt), FUNCTION('MONTH', o.createdAt), " +
           "COALESCE(SUM(o.grandTotal), 0), COUNT(o) FROM Order o " +
           "WHERE o.status <> 'PLACED' AND o.status <> 'CANCELLED' " +
           "AND o.createdAt >= :start AND o.createdAt < :end " +
           "GROUP BY FUNCTION('YEAR', o.createdAt), FUNCTION('MONTH', o.createdAt)")
    List<Object[]> revenueByMonthBetween(@Param("start") LocalDateTime start, @Param("end") LocalDateTime end);

    @Query("SELECT FUNCTION('DATE', o.createdAt), COALESCE(SUM(o.grandTotal), 0), COUNT(o) FROM Order o " +
           "WHERE o.status <> 'PLACED' AND o.status <> 'CANCELLED' " +
           "AND o.createdAt >= :start AND o.createdAt < :end " +
           "GROUP BY FUNCTION('DATE', o.createdAt)")
    List<Object[]> revenueByDayBetween(@Param("start") LocalDateTime start, @Param("end") LocalDateTime end);

    @Query("SELECT o FROM Order o WHERE o.status <> 'PLACED' AND o.status <> 'CANCELLED' " +
           "AND o.createdAt >= :start AND o.createdAt < :end ORDER BY o.createdAt DESC")
    List<Order> findRevenueOrdersBetween(@Param("start") LocalDateTime start, @Param("end") LocalDateTime end);

    @Query("SELECT o FROM Order o " +
           "WHERE o.createdAt >= :start AND o.createdAt < :end ORDER BY o.createdAt DESC")
    List<Order> findAllOrdersBetween(@Param("start") LocalDateTime start, @Param("end") LocalDateTime end);

    long countByStatusNot(OrderStatus status);

    /**
     * Backing query for the admin Delivery board. All filters are optional and
     * are combined with AND; an empty {@code statuses} collection is never
     * passed because Hibernate cannot translate an empty IN () clause.
     */
    @Query("SELECT o FROM Order o WHERE o.status IN :statuses " +
           "AND (:keyword IS NULL OR LOWER(o.orderNumber) LIKE LOWER(CONCAT('%', :keyword, '%')) " +
           "OR LOWER(o.customerName) LIKE LOWER(CONCAT('%', :keyword, '%')) " +
           "OR o.customerPhone LIKE CONCAT('%', :keyword, '%')) " +
           "AND (:boyId IS NULL OR EXISTS (SELECT a.id FROM DeliveryAssignment a " +
           "WHERE a.order = o AND a.deliveryBoy.id = :boyId)) " +
           "AND (:from IS NULL OR o.createdAt >= :from) " +
           "AND (:to IS NULL OR o.createdAt < :to) " +
           "ORDER BY o.createdAt DESC")
    List<Order> searchDeliveryBoard(@Param("statuses") java.util.Collection<OrderStatus> statuses,
                                    @Param("keyword") String keyword,
                                    @Param("boyId") Long boyId,
                                    @Param("from") LocalDateTime from,
                                    @Param("to") LocalDateTime to);
}
