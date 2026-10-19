package com.freshmeat.dto;

import lombok.Data;

/** Card counters at the top of the admin Delivery page. */
@Data
public class DeliveryBoardSummaryDTO {
    private long pendingAssignment;
    private long assigned;
    private long outForDelivery;
    private long delivered;
}
