package com.freshmeat.enums;

/**
 * Lifecycle of a single delivery assignment row.
 * <p>
 * Rows are append-only history: a reassignment closes the previous row with
 * {@link #REASSIGNED} and inserts a new {@link #ASSIGNED} row, and a
 * cancellation closes the open row with {@link #CANCELLED}. Nothing is ever
 * physically deleted, so the delivery trail of an order survives a delivery
 * boy being deactivated.
 */
public enum DeliveryAssignmentStatus {
    /** Assigned to a delivery boy, delivery not started yet. */
    ASSIGNED,
    /** Delivery boy pressed "Start Delivery"; order moved to OUT_FOR_DELIVERY. */
    STARTED,
    /** Order reached the customer and was marked delivered. */
    COMPLETED,
    /** The order was cancelled before delivery completed. */
    CANCELLED,
    /** The order was handed over to a different delivery boy. */
    REASSIGNED
}
