package com.freshmeat.repository;

import com.freshmeat.entity.DeliveryAssignment;

import java.util.Collection;
import java.util.List;

/**
 * Assignment queries that filter or sort on fields of the <b>order</b> document
 * (the delivery-board search and the delivery boy's list) — with the order
 * stored as a cross-collection reference, those are two-step queries. The
 * distinct-id lookups also live here.
 */
public interface DeliveryAssignmentRepositoryCustom {

    /**
     * Delivery-boy work list: assignments of this boy whose order is in one of
     * the given states, optionally filtered by order number / customer name /
     * customer phone, ordered by the order's delivery slot then newest first.
     */
    List<DeliveryAssignment> searchForDeliveryBoy(Long deliveryBoyId,
                                                 Collection<com.freshmeat.enums.OrderStatus> statuses,
                                                 String search);

    /** Same list, but for a single order state (used by the delivery-boy detail screen). */
    List<DeliveryAssignment> findByDeliveryBoyIdAndOrderStatus(
            Long deliveryBoyId, com.freshmeat.enums.OrderStatus status);

    /** Distinct order ids in the given states, out of the supplied candidates. */
    List<Long> findAssignedOrderIds(Collection<Long> orderIds,
                                    Collection<com.freshmeat.enums.DeliveryAssignmentStatus> statuses);

    /** Distinct order ids this boy currently holds in the given states. */
    List<Long> findOrderIdsByDeliveryBoyIdAndStatusIn(
            Long deliveryBoyId,
            Collection<com.freshmeat.enums.DeliveryAssignmentStatus> statuses);
}
