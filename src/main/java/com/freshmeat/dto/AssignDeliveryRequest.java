package com.freshmeat.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;

/**
 * Assign / reassign payload for an order. Alongside the Delivery Boy, the admin
 * picks the delivery date and one of the weekday/weekend time slots; the backend
 * validates the slot against the chosen date's day of week.
 * <p>
 * {@code deliveryDate} is a plain ISO {@code yyyy-MM-dd} date so it round-trips
 * without any timezone shift.
 */
public class AssignDeliveryRequest {

    @NotNull(message = "Select a Delivery Boy")
    private Long deliveryBoyId;

    @NotNull(message = "Select a delivery date")
    @JsonFormat(pattern = "yyyy-MM-dd")
    private LocalDate deliveryDate;

    private String deliverySlot;

    public Long getDeliveryBoyId() { return deliveryBoyId; }
    public void setDeliveryBoyId(Long deliveryBoyId) { this.deliveryBoyId = deliveryBoyId; }

    public LocalDate getDeliveryDate() { return deliveryDate; }
    public void setDeliveryDate(LocalDate deliveryDate) { this.deliveryDate = deliveryDate; }

    public String getDeliverySlot() { return deliverySlot; }
    public void setDeliverySlot(String deliverySlot) { this.deliverySlot = deliverySlot; }
}
