package com.freshmeat.enums;

/**
 * Board state of an order on the admin Delivery page and on the delivery-boy
 * dashboard. It is derived from the order status plus the presence of an open
 * delivery assignment — no new order status is introduced and the canonical
 * order lifecycle (PLACED -&gt; CONFIRMED -&gt; PREPARING -&gt; READY_FOR_PICKUP
 * -&gt; OUT_FOR_DELIVERY -&gt; DELIVERED, plus CANCELLED) is untouched.
 */
public enum DeliveryState {
    /**
     * The order is CONFIRMED (or being PREPARED) and no Delivery Boy has been
     * confirmed for it yet, so the admin still has to pick one.
     */
    PENDING_ASSIGNMENT,
    /**
     * A Delivery Boy is assigned; the order is still in the store (CONFIRMED,
     * PREPARING or READY_FOR_PICKUP) and has not left yet.
     */
    ASSIGNED,
    /** The delivery boy has started the delivery. */
    OUT_FOR_DELIVERY,
    /** The order reached the customer. */
    DELIVERED
}
