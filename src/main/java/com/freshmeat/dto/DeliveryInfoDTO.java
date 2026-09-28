package com.freshmeat.dto;

import lombok.Data;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * Delivery block attached to an {@link OrderDTO}. Only populated for admin and
 * for the delivery boy who owns the assignment — customer responses never
 * carry it, so no internal delivery information leaks to shoppers.
 */
@Data
public class DeliveryInfoDTO {

    private Long assignmentId;
    private Long deliveryBoyId;
    private String deliveryBoyName;
    private String deliveryBoyPhone;
    /**
     * False when the delivery boy has since been deactivated. Assignments are
     * never deleted, so an inactive boy can still show up on an old delivery.
     */
    private boolean deliveryBoyActive = true;

    /** PENDING_ASSIGNMENT / ASSIGNED / OUT_FOR_DELIVERY / DELIVERED */
    private String state;
    /** Raw assignment status, or null when the order is not assigned. */
    private String assignmentStatus;

    private LocalDateTime assignedAt;
    private LocalDateTime startedAt;
    private LocalDateTime completedAt;
    private String assignedBy;

    /** True when the assigned delivery boy may press "Start Delivery". */
    private boolean canStart;
    /** True when the assigned delivery boy may press "Mark Delivered". */
    private boolean canMarkDelivered;
    /**
     * True only for cash-on-delivery orders whose payment is still not PAID.
     * Collect-cash and mark-delivered stay two separate, explicit actions.
     */
    private boolean canCollectCash;

    private List<DeliveryAssignmentDTO> history = new ArrayList<>();
}
