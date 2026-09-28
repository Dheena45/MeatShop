package com.freshmeat.repository;

import com.freshmeat.entity.DeliveryAssignment;
import com.freshmeat.enums.DeliveryAssignmentStatus;
import com.freshmeat.enums.OrderStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface DeliveryAssignmentRepository extends JpaRepository<DeliveryAssignment, Long> {

    /** Every assignment of an order, oldest first — the full delivery history. */
    List<DeliveryAssignment> findByOrderIdOrderByAssignedAtAsc(Long orderId);

    /** Batch variant used to enrich a whole delivery board in two queries. */
    List<DeliveryAssignment> findByOrderIdInOrderByAssignedAtAsc(Collection<Long> orderIds);

    /** The still-open assignment of an order, if any (the one an action applies to). */
    @Query("SELECT a FROM DeliveryAssignment a WHERE a.order.id = :orderId AND a.status IN :statuses " +
           "ORDER BY a.assignedAt DESC")
    List<DeliveryAssignment> findOpenByOrderId(@Param("orderId") Long orderId,
                                              @Param("statuses") Collection<DeliveryAssignmentStatus> statuses);

    Optional<DeliveryAssignment> findFirstByOrderIdOrderByAssignedAtDesc(Long orderId);

    /** Batch lookup so the pending-assignment board does not need N+1 queries. */
    @Query("SELECT DISTINCT a.order.id FROM DeliveryAssignment a " +
           "WHERE a.order.id IN :orderIds AND a.status IN :statuses")
    List<Long> findAssignedOrderIds(@Param("orderIds") Collection<Long> orderIds,
                                    @Param("statuses") Collection<DeliveryAssignmentStatus> statuses);

    /** Assignment of every order currently in one of the given states. */
    @Query("SELECT a FROM DeliveryAssignment a WHERE a.deliveryBoy.id = :boyId " +
           "AND a.status IN :statuses ORDER BY a.assignedAt DESC")
    List<DeliveryAssignment> findByDeliveryBoyIdAndStatusIn(
            @Param("boyId") Long boyId,
            @Param("statuses") Collection<DeliveryAssignmentStatus> statuses);

    List<DeliveryAssignment> findByDeliveryBoyId(Long boyId);

    List<DeliveryAssignment> findByDeliveryBoyIdAndStatus(Long boyId, DeliveryAssignmentStatus status);

    long countByDeliveryBoyId(Long boyId);

    long countByDeliveryBoyIdAndStatus(Long boyId, DeliveryAssignmentStatus status);

    long countByDeliveryBoyIdAndStatusIn(Long boyId, Collection<DeliveryAssignmentStatus> statuses);

    long countByStatusIn(Collection<DeliveryAssignmentStatus> statuses);

    @Query("SELECT a FROM DeliveryAssignment a WHERE a.status IN :statuses ORDER BY a.assignedAt DESC")
    List<DeliveryAssignment> findByStatusIn(@Param("statuses") Collection<DeliveryAssignmentStatus> statuses);

    @Query("SELECT a FROM DeliveryAssignment a " +
           "WHERE a.status IN :statuses AND a.assignedAt >= :start AND a.assignedAt < :end")
    List<DeliveryAssignment> findByStatusInAndAssignedAtBetween(
            @Param("statuses") Collection<DeliveryAssignmentStatus> statuses,
            @Param("start") LocalDateTime start,
            @Param("end") LocalDateTime end);

    /** Today's slice of one delivery boy's work list. */
    List<DeliveryAssignment> findByDeliveryBoyIdAndStatusInAndAssignedAtBetween(
            Long boyId, Collection<DeliveryAssignmentStatus> statuses,
            LocalDateTime start, LocalDateTime end);

    long countByDeliveryBoyIdAndStatusInAndAssignedAtBetween(
            Long boyId, Collection<DeliveryAssignmentStatus> statuses,
            LocalDateTime start, LocalDateTime end);

    /**
     * Deliveries actually completed inside a window. Filtered on completedAt (not
     * assignedAt) so "delivered today" stays correct for an order assigned days ago.
     */
    @Query("SELECT COUNT(a) FROM DeliveryAssignment a " +
           "WHERE a.deliveryBoy.id = :boyId AND a.status = :status " +
           "AND a.completedAt IS NOT NULL AND a.completedAt >= :start AND a.completedAt < :end")
    long countCompletedByDeliveryBoyBetween(@Param("boyId") Long boyId,
                                            @Param("status") DeliveryAssignmentStatus status,
                                            @Param("start") LocalDateTime start,
                                            @Param("end") LocalDateTime end);

    /**
     * Delivery-boy dashboard query. Scoped to one delivery boy and to a set of
     * order states so a boy can never see (or act on) somebody else's order,
     * and cancelled orders are never part of an active delivery list.
     */
    @Query("SELECT a FROM DeliveryAssignment a JOIN FETCH a.order o " +
           "WHERE a.deliveryBoy.id = :boyId AND o.status IN :statuses " +
           "AND (:search IS NULL OR LOWER(o.orderNumber) LIKE LOWER(CONCAT('%', :search, '%')) " +
           "OR LOWER(o.customerName) LIKE LOWER(CONCAT('%', :search, '%')) " +
           "OR o.customerPhone LIKE CONCAT('%', :search, '%')) " +
           "ORDER BY o.deliverySlot ASC, o.createdAt DESC")
    List<DeliveryAssignment> searchForDeliveryBoy(
            @Param("boyId") Long boyId,
            @Param("statuses") Collection<OrderStatus> statuses,
            @Param("search") String search);

    @Query("SELECT a FROM DeliveryAssignment a JOIN FETCH a.order o " +
           "WHERE a.deliveryBoy.id = :boyId AND o.status = :status ORDER BY o.createdAt DESC")
    List<DeliveryAssignment> findByDeliveryBoyIdAndOrderStatus(
            @Param("boyId") Long boyId, @Param("status") OrderStatus status);

    /**
     * Ids of the orders this boy currently owns, i.e. whose open assignment is
     * his. Scoping to the boy here (not just "the order has an open assignment")
     * is what keeps a reassigned order out of the previous boy's list.
     */
    @Query("SELECT a.order.id FROM DeliveryAssignment a " +
           "WHERE a.deliveryBoy.id = :boyId AND a.status IN :statuses")
    List<Long> findOrderIdsByDeliveryBoyIdAndStatusIn(
            @Param("boyId") Long boyId,
            @Param("statuses") Collection<DeliveryAssignmentStatus> statuses);
}
