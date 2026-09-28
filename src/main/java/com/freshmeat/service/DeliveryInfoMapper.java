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
import com.freshmeat.repository.PaymentRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.EnumSet;
import java.util.HashMap;
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
     * Order statuses a Delivery Boy can be assigned to: the admin confirms a boy
     * on a {@code CONFIRMED} order (which is what unlocks PREPARING), and the
     * order stays reassignable while it is still being PREPARED because the
     * delivery has not left the store yet.
     */
    public static final Set<OrderStatus> ASSIGNABLE_STATUSES = Collections.unmodifiableSet(
            EnumSet.of(OrderStatus.CONFIRMED, OrderStatus.PREPARING));

    @Autowired
    private DeliveryAssignmentRepository deliveryAssignmentRepository;

    @Autowired
    private PaymentRepository paymentRepository;

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
        return switch (status) {
            case DELIVERED -> DeliveryState.DELIVERED;
            case OUT_FOR_DELIVERY -> DeliveryState.OUT_FOR_DELIVERY;
            case READY_FOR_PICKUP, CONFIRMED, PREPARING -> hasOpenAssignment
                    ? DeliveryState.ASSIGNED
                    : DeliveryState.PENDING_ASSIGNMENT;
            default -> null;
        };
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
                .findOpenByOrderId(orderId, OPEN_STATUSES)
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

    @Transactional(readOnly = true)
    public DeliveryInfoDTO build(Order order, User viewer) {
        return buildAll(Collections.singletonList(order), viewer).get(order.getId());
    }

    /**
     * Enriches a batch of orders with their delivery block using two extra
     * queries in total. {@code viewer} is the authenticated delivery boy when
     * the caller is a delivery boy, {@code null} for an admin, and the
     * action flags are only ever enabled for the boy who owns the assignment.
     */
    @Transactional(readOnly = true)
    public Map<Long, DeliveryInfoDTO> buildAll(List<Order> orders, User viewer) {
        Map<Long, DeliveryInfoDTO> result = new LinkedHashMap<>();
        if (orders == null || orders.isEmpty()) return result;

        List<Long> orderIds = orders.stream().map(Order::getId).toList();

        Map<Long, List<DeliveryAssignment>> byOrder = new HashMap<>();
        for (DeliveryAssignment a : deliveryAssignmentRepository.findByOrderIdInOrderByAssignedAtAsc(orderIds)) {
            byOrder.computeIfAbsent(a.getOrder().getId(), k -> new ArrayList<>()).add(a);
        }

        Map<Long, Payment> payments = new HashMap<>();
        for (Payment p : paymentRepository.findByOrderIdIn(orderIds)) {
            payments.put(p.getOrder().getId(), p);
        }

        for (Order order : orders) {
            List<DeliveryAssignment> history = byOrder.getOrDefault(order.getId(), Collections.emptyList());
            result.put(order.getId(), assemble(order, payments.get(order.getId()), history, viewer));
        }
        return result;
    }

    private DeliveryInfoDTO assemble(Order order, Payment payment,
                                     List<DeliveryAssignment> history, User viewer) {
        DeliveryInfoDTO info = new DeliveryInfoDTO();

        DeliveryAssignment open = null;
        List<DeliveryAssignmentDTO> historyDtos = new ArrayList<>(history.size());
        for (DeliveryAssignment a : history) {
            if (open == null && OPEN_STATUSES.contains(a.getStatus())) open = a;
            historyDtos.add(toDto(a));
        }
        info.setHistory(historyDtos);

        boolean hasOpen = open != null;
        DeliveryState state = stateOf(order, hasOpen);
        info.setState(state == null ? null : state.name());

        if (open != null) {
            info.setAssignmentId(open.getId());
            info.setAssignmentStatus(open.getStatus().name());
            info.setAssignedAt(open.getAssignedAt());
            info.setStartedAt(open.getStartedAt());
            info.setCompletedAt(open.getCompletedAt());
            info.setAssignedBy(open.getAssignedBy() != null ? open.getAssignedBy().getName() : null);
            if (open.getDeliveryBoy() != null) {
                info.setDeliveryBoyId(open.getDeliveryBoy().getId());
                info.setDeliveryBoyName(open.getDeliveryBoy().getName());
                info.setDeliveryBoyPhone(open.getDeliveryBoy().getPhone());
                info.setDeliveryBoyActive(open.getDeliveryBoy().getEnabled());
            }
        } else {
            // Fall back to the most recent historical row so a delivered order
            // still shows who handled it after the assignment was closed out.
            DeliveryAssignment latest = history.isEmpty() ? null : history.get(history.size() - 1);
            if (latest != null) {
                info.setAssignmentId(latest.getId());
                info.setAssignmentStatus(latest.getStatus().name());
                info.setAssignedAt(latest.getAssignedAt());
                info.setStartedAt(latest.getStartedAt());
                info.setCompletedAt(latest.getCompletedAt());
                info.setAssignedBy(latest.getAssignedBy() != null ? latest.getAssignedBy().getName() : null);
                if (latest.getDeliveryBoy() != null) {
                    info.setDeliveryBoyId(latest.getDeliveryBoy().getId());
                    info.setDeliveryBoyName(latest.getDeliveryBoy().getName());
                    info.setDeliveryBoyPhone(latest.getDeliveryBoy().getPhone());
                    info.setDeliveryBoyActive(latest.getDeliveryBoy().getEnabled());
                }
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
        // Preparation is finished at this point, so this is the "take the order
        // out for delivery" step: READY_FOR_PICKUP -> OUT_FOR_DELIVERY.
        info.setCanStart(order.getStatus() == OrderStatus.READY_FOR_PICKUP);
        info.setCanMarkDelivered(order.getStatus() == OrderStatus.OUT_FOR_DELIVERY
                && payment != null
                && payment.getPaymentStatus() == PaymentStatus.PAID);
    }

    public DeliveryAssignmentDTO toDto(DeliveryAssignment a) {
        DeliveryAssignmentDTO dto = new DeliveryAssignmentDTO();
        dto.setId(a.getId());
        dto.setOrderId(a.getOrder() != null ? a.getOrder().getId() : null);
        dto.setOrderNumber(a.getOrder() != null ? a.getOrder().getOrderNumber() : null);
        dto.setDeliveryBoyId(a.getDeliveryBoy() != null ? a.getDeliveryBoy().getId() : null);
        dto.setDeliveryBoyName(a.getDeliveryBoy() != null ? a.getDeliveryBoy().getName() : null);
        dto.setDeliveryBoyPhone(a.getDeliveryBoy() != null ? a.getDeliveryBoy().getPhone() : null);
        dto.setStatus(a.getStatus().name());
        dto.setAssignedAt(a.getAssignedAt());
        dto.setStartedAt(a.getStartedAt());
        dto.setCompletedAt(a.getCompletedAt());
        dto.setAssignedBy(a.getAssignedBy() != null ? a.getAssignedBy().getName() : null);
        return dto;
    }

    public boolean isDeliveryBoy(User user) {
        return user != null && user.getRole() == Role.DELIVERY_BOY;
    }
}
