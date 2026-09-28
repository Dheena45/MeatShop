package com.freshmeat.dto;

import lombok.Data;

import java.time.LocalDateTime;

/**
 * One historical delivery assignment of an order. Rows are never deleted, so
 * this list is the audit trail shown to the admin.
 */
@Data
public class DeliveryAssignmentDTO {
    private Long id;
    private Long orderId;
    private String orderNumber;
    private Long deliveryBoyId;
    private String deliveryBoyName;
    private String deliveryBoyPhone;
    /** ASSIGNED / STARTED / COMPLETED / CANCELLED / REASSIGNED */
    private String status;
    private LocalDateTime assignedAt;
    private LocalDateTime startedAt;
    private LocalDateTime completedAt;
    private String assignedBy;
}
