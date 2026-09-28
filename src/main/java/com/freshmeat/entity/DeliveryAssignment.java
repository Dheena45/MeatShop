package com.freshmeat.entity;

import com.freshmeat.enums.DeliveryAssignmentStatus;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

/**
 * One row of delivery history for an order.
 * <p>
 * The order number, customer and delivery address are NOT duplicated here: the
 * assignment always points at the {@link Order}, which already stores an
 * immutable snapshot of the address as it was at checkout.
 * <p>
 * There is deliberately no cascade from {@code orders} or {@code users}: orders
 * are never deleted and delivery boys are only ever soft-deactivated
 * ({@code enabled = false}), so the foreign keys below always resolve.
 */
@Entity
@Table(name = "delivery_assignments", indexes = {
        @Index(name = "idx_da_order", columnList = "order_id"),
        @Index(name = "idx_da_boy", columnList = "delivery_boy_id"),
        @Index(name = "idx_da_status", columnList = "status"),
        @Index(name = "idx_da_assigned", columnList = "assigned_at")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class DeliveryAssignment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "order_id", nullable = false)
    private Order order;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "delivery_boy_id", nullable = false)
    private User deliveryBoy;

    /** The admin who handed this order over (null for rows created before this column existed). */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "assigned_by_id")
    private User assignedBy;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private DeliveryAssignmentStatus status = DeliveryAssignmentStatus.ASSIGNED;

    @Column(name = "assigned_at", nullable = false)
    private LocalDateTime assignedAt;

    @Column(name = "started_at")
    private LocalDateTime startedAt;

    @Column(name = "completed_at")
    private LocalDateTime completedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
        if (this.assignedAt == null) this.assignedAt = this.createdAt;
    }

    /** True while this row is the one an order is currently assigned through. */
    public boolean isOpen() {
        return status == DeliveryAssignmentStatus.ASSIGNED
                || status == DeliveryAssignmentStatus.STARTED
                || status == DeliveryAssignmentStatus.COMPLETED;
    }
}
