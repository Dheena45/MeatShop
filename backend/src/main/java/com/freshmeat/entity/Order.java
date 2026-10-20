package com.freshmeat.entity;

import com.freshmeat.enums.OrderStatus;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.annotation.AccessType;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.DBRef;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * MongoDB document.
 * <p>
 * Three deliberate differences from the old JPA entity:
 * <ul>
 *   <li>{@code items} and {@code payment} are <b>embedded</b> — the whole order
 *       is one document, so checkout, cancellation and the payment status
 *       change can never end up half-written, and {@code order.getPayment()}
 *       keeps working without a repository lookup;</li>
 *   <li>the user is a plain {@code userId} (what every query filters on) plus a
 *       lazy {@code @DBRef} for the rare path that needs the user document —
 *       the custom setter keeps them in sync;</li>
 *   <li>{@code deliveryAssignments} is gone — it was never read anywhere.</li>
 * </ul>
 */
@Document(collection = "orders")
@AccessType(AccessType.Type.FIELD)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class Order {

    @Id
    private Long id;

    @Indexed(name = "idx_orders_number", unique = true)
    private String orderNumber;

    /** Plain copy of {@link #user}'s id — what every order query filters on. */
    @Indexed(name = "idx_orders_user")
    private Long userId;

    @DBRef(lazy = true)
    private User user;

    private BigDecimal subtotal;

    private BigDecimal discountAmount = BigDecimal.ZERO;

    private BigDecimal deliveryCharge = BigDecimal.ZERO;

    private BigDecimal tax = BigDecimal.ZERO;

    private BigDecimal grandTotal;

    private String deliverySlot;

    @Indexed(name = "idx_orders_status")
    private OrderStatus status = OrderStatus.CONFIRMED;

    private String deliveryDoor;

    private String deliveryStreet;

    private String deliveryArea;

    private String deliveryCity;

    private String deliveryState;

    private String deliveryPincode;

    private String customerName;

    private String customerPhone;

    private String notes;

    /** Embedded line items — same document as the order, no cascade needed. */
    private List<OrderItem> items = new ArrayList<>();

    /** Embedded payment — updated together with the order in one save. */
    private Payment payment;

    @Indexed(name = "idx_orders_created")
    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    /** Keeps the plain {@link #userId} in sync with the object reference. */
    public void setUser(User user) {
        this.user = user;
        this.userId = user == null ? null : user.getId();
    }
}
