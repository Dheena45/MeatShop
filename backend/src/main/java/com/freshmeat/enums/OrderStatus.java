package com.freshmeat.enums;

/**
 * The canonical order lifecycle:
 * <pre>
 *   PLACED -> CONFIRMED -> PREPARING -> READY_FOR_PICKUP -> OUT_FOR_DELIVERY -> DELIVERED
 * </pre>
 * plus CANCELLED as a separate terminal status reachable from any
 * pre-delivery stage.
 * <p>
 * {@code PLACED} is produced while an online payment is still awaiting gateway
 * confirmation; a COD order is created already {@code CONFIRMED}.
 * <p>
 * After {@code CONFIRMED} the admin confirms a Delivery Boy for the order. That
 * assignment is what unlocks {@code CONFIRMED -> PREPARING} — without it the
 * backend rejects the step. Once the store has finished preparing the order it
 * becomes {@code READY_FOR_PICKUP}, and from there the assigned Delivery Boy
 * takes it to the customer ({@code READY_FOR_PICKUP -> OUT_FOR_DELIVERY}).
 * <p>
 * Values are persisted as plain strings in a {@code varchar(30)} column, so
 * adding or reordering a constant needs no schema change and every existing
 * {@code PLACED} / {@code CONFIRMED} / {@code OUT_FOR_DELIVERY} row keeps
 * reading exactly as before.
 */
public enum OrderStatus {
    PLACED,
    /** Confirmed by the admin. A Delivery Boy must be confirmed before preparation. */
    CONFIRMED,
    /** Being prepared by the store. Requires an assigned Delivery Boy. */
    PREPARING,
    /** Preparation finished; the assigned Delivery Boy can take the order out. */
    READY_FOR_PICKUP,
    /** On the road with the assigned Delivery Boy. */
    OUT_FOR_DELIVERY,
    DELIVERED,
    CANCELLED
}
