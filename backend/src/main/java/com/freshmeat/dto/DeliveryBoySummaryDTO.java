package com.freshmeat.dto;

import lombok.Data;

/** Card counters at the top of the delivery-boy dashboard. */
@Data
public class DeliveryBoySummaryDTO {
    /** Orders assigned to this boy whose delivery date is today. */
    private long todayDeliveries;
    /** Assigned but not yet started. */
    private long pendingDeliveries;
    /** Started but not yet delivered. */
    private long outForDelivery;
    /** Delivered. */
    private long completedDeliveries;
}
