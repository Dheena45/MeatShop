package com.freshmeat.service;

import com.freshmeat.dto.DeliveryAssignmentDTO;
import com.freshmeat.dto.DeliveryInfoDTO;
import com.freshmeat.entity.DeliveryAssignment;
import com.freshmeat.entity.Order;
import com.freshmeat.entity.Payment;
import com.freshmeat.entity.User;
import com.freshmeat.enums.DeliveryAssignmentStatus;
import com.freshmeat.enums.DeliveryState;
import com.freshmeat.enums.OrderStatus;
import com.freshmeat.enums.PaymentMethod;
import com.freshmeat.enums.PaymentStatus;
import com.freshmeat.enums.Role;
import com.freshmeat.repository.DeliveryAssignmentRepository;
import com.freshmeat.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Turns orders + their assignment history into the {@link DeliveryInfoDTO}
 * block. Kept separate from {@link OrderService} so the order service can
 * enrich its own DTOs without a circular bean dependency, and separate from
 * {@link DeliveryService} so it holds no business rules of its own.
 * <p>
 * The order status stays the single source of truth for how far the delivery
 * has progressed; the assignment rows only record who, when and — as an
 * append-only audit trail — every handover in between. A {@code CONFIRMED} or
 * {@code PREPARING} order is still in the store: unassigned it reads as
 * {@code PENDING_ASSIGNMENT}, assigned it reads as {@code ASSIGNED}. A
 * {@code READY_FOR_PICKUP} order is also {@code ASSIGNED} because by then a
 * Delivery Boy is required, and it stays there until he takes it out.
 */
@Component
public class DeliveryInfoMapper {

    /** Assignments that still represent the order's current delivery owner. */
    public static final Set<DeliveryAssignmentStatus> OPEN_STATUSES = Collections.unmodifiableSet(
            EnumSet.of(DeliveryAssignmentStatus.ASSIGNED,
                    DeliveryAssignmentStatus.STARTED,
                    DeliveryAssignmentStatus.COMPLETED));

    /** Order statuses an order can be in while it is waiting for / with a delivery boy. */
    public static final Set<OrderStatus> IN_FLIGHT_STATUSES = Collections.unmodifiableSet(
            EnumSet.of(OrderStatus.CONFIRMED, OrderStatus.PREPARING, OrderStatus.READY_FOR_PICKUP,
                    OrderStatus.OUT_FOR_DELIVERY, OrderStatus.DELIVERED));

    /**
     * Order statuses a Delivery Boy can be assigned or reassigned to: the admin
     * can confirm a boy on a {@code CONFIRMED} order, usually once preparation is
     * complete ({@code PREPARING}), and the order stays reassignable through
     * {@code READY_FOR_PICKUP} because the parcel has not left the store until
     * the boy confirms pickup.
     */
    public static final Set<OrderStatus> ASSIGNABLE_STATUSES = Collections.unmodifiableSet(
            EnumSet.of(OrderStatus.CONFIRMED, OrderStatus.PREPARING, OrderStatus.READY_FOR_PICKUP));

    @Autowired
    private DeliveryAssignmentRepository deliveryAssignmentRepository;

    @Autowired
    private UserRepository userRepository;

    /**
     * Board state of an order, derived from its status and whether an open
     * assignment exists. Cancelled orders have no delivery state at all, which
     * is what keeps them off the delivery board.
     */
    public DeliveryState stateOf(Order order, boolean hasOpenAssignment) {
        OrderStatus status = order.getStatus();
        if (status == null || status == OrderStatus.CANCELLED || status == OrderStatus.PLACED) {
            return null;
        }
        // Plain comparisons instead of a switch expression over the enum: the
        // javac switch over an enum is routed through a synthetic switch-map
        // class (DeliveryInfoMapper$1). If a build ever ships DeliveryInfoMapper
        // without that synthetic class (broken incremental compile / IDE build),
        // the JVM throws NoClassDefFoundError on this exact method and every
        // read of a DELIVERED or OUT_FOR_DELIVERY order returns 500. If/else
        // comparisons carry no such hidden dependency.
        if (status == OrderStatus.DELIVERED) {
            return DeliveryState.DELIVERED;
        }
        if (status == OrderStatus.OUT_FOR_DELIVERY) {
            return DeliveryState.OUT_FOR_DELIVERY;
        }
        if (status == OrderStatus.READY_FOR_PICKUP
                || status == OrderStatus.CONFIRMED
                || status == OrderStatus.PREPARING) {
            return hasOpenAssignment ? DeliveryState.ASSIGNED : DeliveryState.PENDING_ASSIGNMENT;
        }
        return null;
    }

    public DeliveryState stateOf(Order order) {
        if (order == null) return null;
        if (order.getStatus() == null) return null;
        if (DeliveryInfoMapper.ASSIGNABLE_STATUSES.contains(order.getStatus())) {
            return hasOpenAssignment(order.getId()) ? DeliveryState.ASSIGNED : DeliveryState.PENDING_ASSIGNMENT;
        }
        return stateOf(order, false);
    }

    public boolean hasOpenAssignment(Long orderId) {
        return !deliveryAssignmentRepository
                .findByOrderIdAndStatusInOrderByAssignedAtDesc(orderId, OPEN_STATUSES)
                .isEmpty();
    }

    public boolean hasOpenAssignmentForAny(Collection<Long> orderIds) {
        if (orderIds == null || orderIds.isEmpty()) return false;
        return !deliveryAssignmentRepository.findAssignedOrderIds(orderIds, OPEN_STATUSES).isEmpty();
    }

    /** Ids of the given orders that already have an open assignment. */
    public Set<Long> openAssignmentOrderIds(Collection<Long> orderIds) {
        if (orderIds == null || orderIds.isEmpty()) return Collections.emptySet();
        return new java.util.HashSet<>(deliveryAssignmentRepository.findAssignedOrderIds(orderIds, OPEN_STATUSES));
    }
    public DeliveryInfoDTO build(Order order, User viewer) {
        return buildAll(Collections.singletonList(order), viewer).get(order.getId());
    }

    /**
     * Enriches a batch of orders with their delivery block using a small,
     * constant number of queries regardless of batch size. {@code viewer} is the
     * authenticated delivery boy when the caller is a delivery boy, {@code null}
     * for an admin, and the action flags are only ever enabled for the boy who
     * owns the assignment.
     */
    public Map<Long, DeliveryInfoDTO> buildAll(List<Order> orders, User viewer) {
        Map<Long, DeliveryInfoDTO> result = new LinkedHashMap<>();
        if (orders == null || orders.isEmpty()) return result;

        List<Long> orderIds = orders.stream().map(Order::getId).toList();

        Map<Long, List<DeliveryAssignment>> byOrder = new HashMap<>();
        Set<Long> boyIds = new HashSet<>();
        for (DeliveryAssignment a : deliveryAssignmentRepository.findByOrderIdInOrderByAssignedAtAsc(orderIds)) {
            byOrder.computeIfAbsent(a.getOrderId(), k -> new ArrayList<>()).add(a);
            // The plain deliveryBoyId is read instead of the DBRef: in Mongo a
            // lazy reference loads its document on any method call, so the id
            // would cost a query (and blow up for a removed account).
            if (a.getDeliveryBoyId() != null) boyIds.add(a.getDeliveryBoyId());
            // The assigning admin is shown by name, so it is resolved in the same
            // batch instead of through the lazy reference.
            if (a.getAssignedById() != null) boyIds.add(a.getAssignedById());
        }
        Map<Long, User> boys = loadUsers(boyIds);

        for (Order order : orders) {
            List<DeliveryAssignment> history = byOrder.getOrDefault(order.getId(), Collections.emptyList());
            // The payment is embedded in the order, so no extra query is needed.
            result.put(order.getId(), assemble(order, order.getPayment(), history, boys, viewer));
        }
        return result;
    }

    /**
     * Loads the users behind a set of ids in one query. Ids with no surviving
     * row (e.g. a Delivery Boy account that was removed) simply go missing from
     * the result instead of blowing up when the association is initialised.
     */
    private Map<Long, User> loadUsers(Set<Long> ids) {
        if (ids == null || ids.isEmpty()) return Collections.emptyMap();
        Map<Long, User> byId = new HashMap<>();
        for (User u : userRepository.findAllById(ids)) {
            byId.put(u.getId(), u);
        }
        return byId;
    }

    /** The assignment's delivery boy, or {@code null} if that account is gone. */
    private User deliveryBoyOf(DeliveryAssignment a, Map<Long, User> boys) {
        if (a == null || a.getDeliveryBoyId() == null) return null;
        return boys.get(a.getDeliveryBoyId());
    }

    /** Display name of a user id, or {@code null} when that account is gone. */
    private String nameOf(Long userId, Map<Long, User> users) {
        if (userId == null) return null;
        User user = users.get(userId);
        return user == null ? null : user.getName();
    }

    private void applyDeliveryBoy(DeliveryInfoDTO info, DeliveryAssignment a, Map<Long, User> boys) {
        User boy = deliveryBoyOf(a, boys);
        if (boy == null) return;
        info.setDeliveryBoyId(boy.getId());
        info.setDeliveryBoyName(boy.getName());
        info.setDeliveryBoyPhone(boy.getPhone());
        info.setDeliveryBoyActive(boy.getEnabled());
    }

    private DeliveryInfoDTO assemble(Order order, Payment payment,
                                     List<DeliveryAssignment> history, Map<Long, User> boys, User viewer) {
        DeliveryInfoDTO info = new DeliveryInfoDTO();

        DeliveryAssignment open = null;
        List<DeliveryAssignmentDTO> historyDtos = new ArrayList<>(history.size());
        for (DeliveryAssignment a : history) {
            if (open == null && OPEN_STATUSES.contains(a.getStatus())) open = a;
            historyDtos.add(toDto(a, order, boys));
        }
        info.setHistory(historyDtos);

        boolean hasOpen = open != null;
        DeliveryState state = stateOf(order, hasOpen);
        info.setState(state == null ? null : state.name());

        if (open != null) {
            info.setAssignmentId(open.getId());
            info.setAssignmentStatus(open.getStatus().name());
            info.setDeliveryDate(open.getDeliveryDate());
            info.setDeliverySlot(open.getDeliverySlot());
            info.setAssignedAt(open.getAssignedAt());
            info.setStartedAt(open.getStartedAt());
            info.setCompletedAt(open.getCompletedAt());
            info.setAssignedBy(nameOf(open.getAssignedById(), boys));
            applyDeliveryBoy(info, open, boys);
        } else {
            // Fall back to the most recent historical row so a delivered order
            // still shows who handled it after the assignment was closed out.
            DeliveryAssignment latest = history.isEmpty() ? null : history.get(history.size() - 1);
            if (latest != null) {
                info.setAssignmentId(latest.getId());
                info.setAssignmentStatus(latest.getStatus().name());
                info.setDeliveryDate(latest.getDeliveryDate());
                info.setDeliverySlot(latest.getDeliverySlot());
                info.setAssignedAt(latest.getAssignedAt());
                info.setStartedAt(latest.getStartedAt());
                info.setCompletedAt(latest.getCompletedAt());
                info.setAssignedBy(nameOf(latest.getAssignedById(), boys));
                applyDeliveryBoy(info, latest, boys);
            }
        }

        if (viewer != null && info.getDeliveryBoyId() != null
                && info.getDeliveryBoyId().equals(viewer.getId())) {
            applyActionFlags(info, order, payment);
        }
        return info;
    }

    /**
     * Only ever called for the delivery boy who owns the open assignment, and
     * only ever reads the order status and the payment row — the three actions
     * remain individually gated and are never collapsed into one another.
     */
    private void applyActionFlags(DeliveryInfoDTO info, Order order, Payment payment) {
        boolean unpaidCod = payment != null
                && payment.getPaymentMethod() == PaymentMethod.CASH_ON_DELIVERY
                && payment.getPaymentStatus() != PaymentStatus.PAID
                && payment.getPaymentStatus() != PaymentStatus.CANCELLED;

        info.setCanCollectCash(unpaidCod && order.getStatus() == OrderStatus.OUT_FOR_DELIVERY);
        // The boy "confirms the pickup" at the store: the parcel is ready, so he
        // takes it out for delivery. READY_FOR_PICKUP -> OUT_FOR_DELIVERY.
        info.setCanStart(order.getStatus() == OrderStatus.READY_FOR_PICKUP);
        // Mark Delivered requires the payment to be PAID. For a COD order the
        // boy has to record the cash through the separate "Collect cash" action
        // first; an online order is already PAID by the gateway. Delivering must
        // never mark an unpaid order as PAID by itself.
        info.setCanMarkDelivered(order.getStatus() == OrderStatus.OUT_FOR_DELIVERY
                && payment != null && payment.getPaymentStatus() == PaymentStatus.PAID);
    }

    /**
     * Assignment row as a DTO. The order is passed in because the assignment only
     * stores the order id — its number (kept for display) lives on the order.
     */
    public DeliveryAssignmentDTO toDto(DeliveryAssignment a, Order order) {
        Set<Long> ids = new HashSet<>();
        if (a != null && a.getDeliveryBoyId() != null) {
            ids.add(a.getDeliveryBoyId());
        }
        if (a != null && a.getAssignedById() != null) {
            ids.add(a.getAssignedById());
        }
        return toDto(a, order, loadUsers(ids));
    }

    private DeliveryAssignmentDTO toDto(DeliveryAssignment a, Order order, Map<Long, User> boys) {
        DeliveryAssignmentDTO dto = new DeliveryAssignmentDTO();
        dto.setId(a.getId());
        dto.setOrderId(a.getOrderId() != null ? a.getOrderId() : (order != null ? order.getId() : null));
        dto.setOrderNumber(order != null ? order.getOrderNumber() : null);
        User boy = deliveryBoyOf(a, boys);
        dto.setDeliveryBoyId(boy != null ? boy.getId() : null);
        dto.setDeliveryBoyName(boy != null ? boy.getName() : null);
        dto.setDeliveryBoyPhone(boy != null ? boy.getPhone() : null);
        dto.setStatus(a.getStatus().name());
        dto.setDeliveryDate(a.getDeliveryDate());
        dto.setDeliverySlot(a.getDeliverySlot());
        dto.setAssignedAt(a.getAssignedAt());
        dto.setStartedAt(a.getStartedAt());
        dto.setCompletedAt(a.getCompletedAt());
        dto.setAssignedBy(nameOf(a.getAssignedById(), boys));
        return dto;
    }

    public boolean isDeliveryBoy(User user) {
        return user != null && user.getRole() == Role.DELIVERY_BOY;
    }
}
