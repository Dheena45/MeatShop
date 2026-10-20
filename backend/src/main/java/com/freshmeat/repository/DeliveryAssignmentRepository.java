package com.freshmeat.repository;

import com.freshmeat.entity.DeliveryAssignment;
import com.freshmeat.enums.DeliveryAssignmentStatus;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

/**
 * Every filter here runs on a stored field ({@code orderId},
 * {@code deliveryBoyId}, {@code status}, {@code assignedAt}/{@code completedAt}),
 * so the old {@code @Query} annotations collapse into derived queries. The
 * queries that reach into the order document are in
 * {@link DeliveryAssignmentRepositoryCustom}.
 */
public interface DeliveryAssignmentRepository extends MongoRepository<DeliveryAssignment, Long>,
        DeliveryAssignmentRepositoryCustom {

    /** Every assignment of an order, oldest first — the full delivery history. */
    List<DeliveryAssignment> findByOrderIdOrderByAssignedAtAsc(Long orderId);

    /** Batch variant used to enrich a whole delivery board in two queries. */
    List<DeliveryAssignment> findByOrderIdInOrderByAssignedAtAsc(Collection<Long> orderIds);

    /** The still-open assignment of an order, if any (the one an action applies to). */
    List<DeliveryAssignment> findByOrderIdAndStatusInOrderByAssignedAtDesc(
            Long orderId, Collection<DeliveryAssignmentStatus> statuses);

    Optional<DeliveryAssignment> findFirstByOrderIdOrderByAssignedAtDesc(Long orderId);

    /** Assignment of every order currently in one of the given states. */
    List<DeliveryAssignment> findByDeliveryBoyIdAndStatusInOrderByAssignedAtDesc(
            Long deliveryBoyId, Collection<DeliveryAssignmentStatus> statuses);

    List<DeliveryAssignment> findByDeliveryBoyId(Long deliveryBoyId);

    List<DeliveryAssignment> findByDeliveryBoyIdAndStatus(Long deliveryBoyId,
                                                          DeliveryAssignmentStatus status);

    long countByDeliveryBoyId(Long deliveryBoyId);

    long countByDeliveryBoyIdAndStatus(Long deliveryBoyId, DeliveryAssignmentStatus status);

    long countByDeliveryBoyIdAndStatusIn(Long deliveryBoyId,
                                         Collection<DeliveryAssignmentStatus> statuses);

    long countByStatusIn(Collection<DeliveryAssignmentStatus> statuses);

    List<DeliveryAssignment> findByStatusInOrderByAssignedAtDesc(
            Collection<DeliveryAssignmentStatus> statuses);

    List<DeliveryAssignment> findByStatusInAndAssignedAtGreaterThanEqualAndAssignedAtLessThan(
            Collection<DeliveryAssignmentStatus> statuses, LocalDateTime start, LocalDateTime end);

    /** Today's slice of one delivery boy's work list. */
    List<DeliveryAssignment> findByDeliveryBoyIdAndStatusInAndAssignedAtBetween(
            Long deliveryBoyId, Collection<DeliveryAssignmentStatus> statuses,
            LocalDateTime start, LocalDateTime end);

    long countByDeliveryBoyIdAndStatusInAndAssignedAtBetween(
            Long deliveryBoyId, Collection<DeliveryAssignmentStatus> statuses,
            LocalDateTime start, LocalDateTime end);

    /**
     * Deliveries actually completed inside a window. Filtered on completedAt (not
     * assignedAt) so "delivered today" stays correct for an order assigned days ago.
     */
    long countByDeliveryBoyIdAndStatusAndCompletedAtNotNullAndCompletedAtGreaterThanEqualAndCompletedAtLessThan(
            Long deliveryBoyId, DeliveryAssignmentStatus status,
            LocalDateTime start, LocalDateTime end);
}
