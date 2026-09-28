package com.freshmeat.dto;

import jakarta.validation.constraints.NotNull;

/** Assign / reassign payload for an order. */
public class AssignDeliveryRequest {

    @NotNull(message = "Select a Delivery Boy")
    private Long deliveryBoyId;

    public Long getDeliveryBoyId() { return deliveryBoyId; }
    public void setDeliveryBoyId(Long deliveryBoyId) { this.deliveryBoyId = deliveryBoyId; }
}
