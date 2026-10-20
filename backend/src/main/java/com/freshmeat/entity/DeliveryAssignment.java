package com.freshmeat.entity;

import com.freshmeat.enums.DeliveryAssignmentStatus;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.annotation.AccessType;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.DBRef;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * One row of delivery history for an order.
 * <p>
 * The order number, customer and delivery address are NOT duplicated here: the
 * assignment stores a plain {@code orderId} and reads the rest from the order
 * when a DTO is built. Order, delivery boy and assigning admin are each kept
 * as a plain id (what every query and dashboard count filters on) plus a lazy
 * {@code @DBRef} for the few paths that need the user/order document; the
 * custom setters keep the pairs in sync.
 * <p>
 * There is deliberately no cascade from orders or users: orders are never
 * deleted and delivery boys are only ever soft-deactivated
 * ({@code enabled = false}), so the references always resolve. Should an
 * account ever be removed while an append-only assignment row remains, the read
 * side ({@code DeliveryInfoMapper}) resolves the boy by id and simply treats a
 * missing one as {@code null}.
 */
@Document(collection = "delivery_assignments")
@AccessType(AccessType.Type.FIELD)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class DeliveryAssignment {

    @Id
    private Long id;

    /** Plain copy of {@link #order}'s id — every board query filters on it. */
    @Indexed(name = "idx_da_order")
    private Long orderId;

    @DBRef(lazy = true)
    private Order order;

    /** Plain copy of {@link #deliveryBoy}'s id — scoped "my list" queries use it. */
    @Indexed(name = "idx_da_boy")
    private Long deliveryBoyId;

    @DBRef(lazy = true)
    private User deliveryBoy;

    /** The admin who handed this order over (null for rows created before this column existed). */
    @Indexed(name = "idx_da_assigned_by")
    private Long assignedById;

    @DBRef(lazy = true)
    private User assignedBy;

    @Indexed(name = "idx_da_status")
    private DeliveryAssignmentStatus status = DeliveryAssignmentStatus.ASSIGNED;

    /**
     * The delivery date the admin selected when handing the order over. Stored on
     * the assignment (not recomputed from the order) so historical records keep
     * the exact date/slot that was promised, even if the customer's checkout slot
     * or the calendar changes later. Plain {@link LocalDate} — no timezone shift.
     */
    private LocalDate deliveryDate;

    private String deliverySlot;

    @Indexed(name = "idx_da_assigned")
    private LocalDateTime assignedAt;

    private LocalDateTime startedAt;

    private LocalDateTime completedAt;

    private LocalDateTime createdAt;

    /** Keeps the plain {@link #orderId} in sync with the object reference. */
    public void setOrder(Order order) {
        this.order = order;
        this.orderId = order == null ? null : order.getId();
    }

    /** Keeps the plain {@link #deliveryBoyId} in sync with the object reference. */
    public void setDeliveryBoy(User deliveryBoy) {
        this.deliveryBoy = deliveryBoy;
        this.deliveryBoyId = deliveryBoy == null ? null : deliveryBoy.getId();
    }

    /** Keeps the plain {@link #assignedById} in sync with the object reference. */
    public void setAssignedBy(User assignedBy) {
        this.assignedBy = assignedBy;
        this.assignedById = assignedBy == null ? null : assignedBy.getId();
    }

    /** True while this row is the one an order is currently assigned through. */
    public boolean isOpen() {
        return status == DeliveryAssignmentStatus.ASSIGNED
                || status == DeliveryAssignmentStatus.STARTED
                || status == DeliveryAssignmentStatus.COMPLETED;
    }
}
