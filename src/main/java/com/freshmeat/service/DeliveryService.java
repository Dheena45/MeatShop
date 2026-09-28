package com.freshmeat.service;

import com.freshmeat.dto.AssignDeliveryRequest;
import com.freshmeat.dto.DeliveryBoardSummaryDTO;
import com.freshmeat.dto.DeliveryBoyDTO;
import com.freshmeat.dto.DeliveryBoyRequest;
import com.freshmeat.dto.DeliveryBoySummaryDTO;
import com.freshmeat.dto.DeliveryInfoDTO;
import com.freshmeat.dto.OrderDTO;
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
import com.freshmeat.exception.BadRequestException;
import com.freshmeat.exception.ConflictException;
import com.freshmeat.exception.DuplicateResourceException;
import com.freshmeat.exception.ForbiddenException;
import com.freshmeat.exception.ResourceNotFoundException;
import com.freshmeat.repository.DeliveryAssignmentRepository;
import com.freshmeat.repository.OrderRepository;
import com.freshmeat.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Collections;
import java.util.EnumSet;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Delivery management on top of the existing order + payment model.
 * <p>
 * Rules enforced here:
 * <ul>
 *   <li>No new order statuses. Delivery progress follows the existing
 *       PREPARING -&gt; READY_FOR_PICKUP -&gt; OUT_FOR_DELIVERY -&gt; DELIVERED
 *       sequence, and the existing cancellation rules are untouched.</li>
 *   <li>No new payment model. Cash collection reuses
 *       {@link PaymentService#markPaymentReceived} and never changes the order
 *       status. An order only becomes DELIVERED through an explicit
 *       "Mark Delivered" action, and only once its payment is PAID.</li>
 *   <li>Assignment rows are append-only history: reassignment closes the old
 *       row, cancellation closes it, deactivating a delivery boy leaves it
 *       alone, and orders are never cascade-deleted.</li>
 *   <li>Ownership is enforced here, server side, on every delivery-boy action,
 *       so changing an id in the URL is not enough.</li>
 * </ul>
 */
@Service
public class DeliveryService {

    /**
     * Order statuses that belong on a delivery board. CANCELLED and PLACED are
     * excluded; an order joins the board once it is CONFIRMED, which is the stage
     * a Delivery Boy is confirmed in.
     */
    private static final Set<OrderStatus> BOARD_STATUSES = Collections.unmodifiableSet(
            EnumSet.of(OrderStatus.CONFIRMED, OrderStatus.PREPARING, OrderStatus.READY_FOR_PICKUP,
                    OrderStatus.OUT_FOR_DELIVERY, OrderStatus.DELIVERED));

    /** Assignments that still count as "work in progress" for a delivery boy. */
    private static final Set<DeliveryAssignmentStatus> ACTIVE_ASSIGNMENT_STATUSES =
            Collections.unmodifiableSet(EnumSet.of(DeliveryAssignmentStatus.ASSIGNED,
                    DeliveryAssignmentStatus.STARTED));

    /** Every assignment status that represents the order's current owner. */
    private static final Set<DeliveryAssignmentStatus> LIVE_ASSIGNMENT_STATUSES =
            Collections.unmodifiableSet(EnumSet.of(DeliveryAssignmentStatus.ASSIGNED,
                    DeliveryAssignmentStatus.STARTED, DeliveryAssignmentStatus.COMPLETED));

    private static final Set<DeliveryAssignmentStatus> TODAY_STATUSES =
            Collections.unmodifiableSet(EnumSet.of(DeliveryAssignmentStatus.ASSIGNED,
                    DeliveryAssignmentStatus.STARTED, DeliveryAssignmentStatus.COMPLETED));

    @Autowired
    private OrderRepository orderRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private DeliveryAssignmentRepository deliveryAssignmentRepository;

    @Autowired
    private DeliveryInfoMapper deliveryInfoMapper;

    @Autowired
    private OrderService orderService;

    @Autowired
    private PaymentService paymentService;

    @Autowired
    private AuthService authService;

    @Autowired
    private PasswordEncoder passwordEncoder;

    /* ================================================================
       Delivery boy management (admin)
       ================================================================ */

    @Transactional(readOnly = true)
    public List<DeliveryBoyDTO> listDeliveryBoys(String search, Boolean activeOnly) {
        String keyword = normalize(search);
        return userRepository.findByRole(Role.DELIVERY_BOY).stream()
                .filter(b -> activeOnly == null || activeOnly.equals(b.getEnabled()))
                .filter(b -> matchesBoy(b, keyword))
                .map(this::toDeliveryBoyDTO)
                .collect(Collectors.toList());
    }

    /** Only active delivery boys may receive a new assignment. */
    @Transactional(readOnly = true)
    public List<DeliveryBoyDTO> listActiveDeliveryBoys() {
        return listDeliveryBoys(null, Boolean.TRUE);
    }

    @Transactional
    public DeliveryBoyDTO createDeliveryBoy(DeliveryBoyRequest request) {
        String name = require(request.getName(), "Name is required");
        String email = require(request.getEmail(), "Email is required").toLowerCase(Locale.ROOT);
        String phone = require(request.getPhone(), "Phone is required");
        String password = require(request.getPassword(), "Password is required");

        if (userRepository.existsByEmailIgnoreCase(email)) {
            throw new DuplicateResourceException("A user with this email already exists.");
        }
        if (userRepository.existsByPhone(phone)) {
            throw new DuplicateResourceException("This mobile number is already registered.");
        }

        User boy = new User();
        boy.setName(name);
        boy.setEmail(email);
        boy.setPhone(phone);
        // BCrypt only — a plain-text password is never stored or logged.
        boy.setPassword(passwordEncoder.encode(password));
        boy.setRole(Role.DELIVERY_BOY);
        boy.setEnabled(request.getActive() == null || request.getActive());
        boy = userRepository.save(boy);

        return toDeliveryBoyDTO(boy);
    }

    @Transactional
    public DeliveryBoyDTO updateDeliveryBoy(Long id, DeliveryBoyRequest request) {
        User boy = requireDeliveryBoyEntity(id);
        final Long boyId = boy.getId();

        String name = require(request.getName(), "Name is required");
        String email = require(request.getEmail(), "Email is required").toLowerCase(Locale.ROOT);
        String phone = require(request.getPhone(), "Phone is required");

        if (userRepository.findByEmailIgnoreCase(email)
                .filter(existing -> !existing.getId().equals(boyId))
                .isPresent()) {
            throw new DuplicateResourceException("A user with this email already exists.");
        }
        boolean phoneTaken = userRepository.findAll().stream()
                .anyMatch(u -> !u.getId().equals(boyId) && phone.equals(u.getPhone()));
        if (phoneTaken) {
            throw new DuplicateResourceException("This mobile number is already registered.");
        }

        boy.setName(name);
        boy.setEmail(email);
        boy.setPhone(phone);
        if (request.getPassword() != null && !request.getPassword().isBlank()) {
            boy.setPassword(passwordEncoder.encode(request.getPassword()));
        }
        if (request.getActive() != null) {
            boy.setEnabled(request.getActive());
        }
        boy = userRepository.save(boy);
        return toDeliveryBoyDTO(boy);
    }

    /**
     * Soft deactivation only. Historical deliveries and orders keep pointing at
     * this row so nothing is lost; an inactive boy simply cannot log in and
     * cannot be picked for a new assignment.
     */
    @Transactional
    public DeliveryBoyDTO setDeliveryBoyActive(Long id, boolean active) {
        User boy = requireDeliveryBoyEntity(id);
        boy.setEnabled(active);
        boy = userRepository.save(boy);
        return toDeliveryBoyDTO(boy);
    }

    private boolean matchesBoy(User boy, String keyword) {
        if (keyword == null) return true;
        return contains(boy.getName(), keyword)
                || contains(boy.getEmail(), keyword)
                || contains(boy.getPhone(), keyword);
    }

    private DeliveryBoyDTO toDeliveryBoyDTO(User boy) {
        DeliveryBoyDTO dto = new DeliveryBoyDTO();
        dto.setId(boy.getId());
        dto.setName(boy.getName());
        dto.setEmail(boy.getEmail());
        dto.setPhone(boy.getPhone());
        dto.setRole(Role.DELIVERY_BOY.name());
        dto.setActive(boy.getEnabled());
        dto.setCreatedAt(boy.getCreatedAt());
        dto.setAssignedCount(deliveryAssignmentRepository
                .countByDeliveryBoyIdAndStatusIn(boy.getId(), ACTIVE_ASSIGNMENT_STATUSES));
        dto.setCompletedCount(deliveryAssignmentRepository
                .countByDeliveryBoyIdAndStatus(boy.getId(), DeliveryAssignmentStatus.COMPLETED));
        LocalDateTime dayStart = LocalDate.now().atStartOfDay();
        dto.setCompletedTodayCount(deliveryAssignmentRepository
                .countCompletedByDeliveryBoyBetween(boy.getId(), DeliveryAssignmentStatus.COMPLETED,
                        dayStart, dayStart.plusDays(1)));
        return dto;
    }

    /* ================================================================
       Admin delivery board
       ================================================================ */

    @Transactional(readOnly = true)
    public List<OrderDTO> adminBoard(DeliveryState state, String search, Long deliveryBoyId, LocalDate date) {
        return enrich(loadBoard(state, search, deliveryBoyId, date), null);
    }

    /**
     * Counters for the four board cards. They honour the active filters (minus
     * the state tab itself) so the cards always describe the visible rows.
     */
    @Transactional(readOnly = true)
    public DeliveryBoardSummaryDTO adminBoardSummary(String search, Long deliveryBoyId, LocalDate date) {
        List<Order> all = loadBoard(null, search, deliveryBoyId, date);
        Set<Long> assigned = deliveryInfoMapper.openAssignmentOrderIds(idsOf(all));

        DeliveryBoardSummaryDTO summary = new DeliveryBoardSummaryDTO();
        for (Order order : all) {
            DeliveryState state = deliveryInfoMapper.stateOf(order, assigned.contains(order.getId()));
            if (state == null) continue;
            switch (state) {
                case PENDING_ASSIGNMENT -> summary.setPendingAssignment(summary.getPendingAssignment() + 1);
                case ASSIGNED -> summary.setAssigned(summary.getAssigned() + 1);
                case OUT_FOR_DELIVERY -> summary.setOutForDelivery(summary.getOutForDelivery() + 1);
                case DELIVERED -> summary.setDelivered(summary.getDelivered() + 1);
                default -> { }
            }
        }
        return summary;
    }

    @Transactional(readOnly = true)
    public OrderDTO adminDeliveryDetail(Long orderId) {
        Order order = requireOrder(orderId);
        if (order.getStatus() == OrderStatus.CANCELLED) {
            throw new ConflictException("This order was cancelled and is not part of delivery management.");
        }
        return enrichOne(order, null);
    }

    private List<Order> loadBoard(DeliveryState state, String search, Long deliveryBoyId, LocalDate date) {
        List<Order> orders = orderRepository.searchDeliveryBoard(
                statusesFor(state), normalize(search), deliveryBoyId,
                date == null ? null : date.atStartOfDay(),
                date == null ? null : date.plusDays(1).atStartOfDay());

        // PENDING_ASSIGNMENT and ASSIGNED both live in the in-store order
        // statuses, so each one has to keep only the half it actually
        // represents: drop assigned orders from the pending bucket, and drop
        // unassigned orders from the assigned bucket.
        if (state == DeliveryState.PENDING_ASSIGNMENT || state == DeliveryState.ASSIGNED) {
            Set<Long> assigned = deliveryInfoMapper.openAssignmentOrderIds(idsOf(orders));
            return orders.stream()
                    .filter(o -> assigned.contains(o.getId()) == (state == DeliveryState.ASSIGNED))
                    .collect(Collectors.toList());
        }
        return orders;
    }

    /**
     * A PENDING_ASSIGNMENT order is one where the admin still has to confirm a
     * Delivery Boy, so it can only be CONFIRMED or PREPARING. An ASSIGNED order
     * is in the store with a boy already confirmed, which additionally includes
     * READY_FOR_PICKUP — that is the order waiting for him to take it out.
     */
    private Set<OrderStatus> statusesFor(DeliveryState state) {
        if (state == null) return BOARD_STATUSES;
        return switch (state) {
            case PENDING_ASSIGNMENT -> DeliveryInfoMapper.ASSIGNABLE_STATUSES;
            case ASSIGNED -> EnumSet.of(OrderStatus.CONFIRMED, OrderStatus.PREPARING,
                    OrderStatus.READY_FOR_PICKUP);
            case OUT_FOR_DELIVERY -> EnumSet.of(OrderStatus.OUT_FOR_DELIVERY);
            case DELIVERED -> EnumSet.of(OrderStatus.DELIVERED);
        };
    }

    /* ================================================================
       Assignment
       ================================================================ */

    @Transactional
    public OrderDTO assign(Long orderId, AssignDeliveryRequest request) {
        return doAssign(orderId, request.getDeliveryBoyId(), false);
    }

    @Transactional
    public OrderDTO reassign(Long orderId, AssignDeliveryRequest request) {
        return doAssign(orderId, request.getDeliveryBoyId(), true);
    }

    private OrderDTO doAssign(Long orderId, Long deliveryBoyId, boolean isReassign) {
        if (deliveryBoyId == null) {
            throw new BadRequestException("Select a Delivery Boy");
        }
        User admin = authService.getCurrentUser();
        Order order = requireOrder(orderId);
        User boy = requireDeliveryBoyEntity(deliveryBoyId);

        if (!boy.getEnabled()) {
            throw new ConflictException(boy.getName() + " is inactive and cannot receive new deliveries.");
        }

        DeliveryAssignment open = findOpenAssignment(orderId).orElse(null);

        if (isReassign) {
            if (open == null) {
                throw new ConflictException("This order is not assigned yet. Use Assign to hand it to a delivery boy.");
            }
            if (!DeliveryInfoMapper.ASSIGNABLE_STATUSES.contains(order.getStatus())) {
                throw new ConflictException("This delivery has already started and can no longer be reassigned.");
            }
            if (open.getDeliveryBoy().getId().equals(boy.getId())) {
                throw new ConflictException(boy.getName() + " is already handling this order.");
            }
        } else {
            if (!DeliveryInfoMapper.ASSIGNABLE_STATUSES.contains(order.getStatus())) {
                throw new ConflictException(
                        "Only confirmed or preparing orders can be assigned to a Delivery Boy.");
            }
            if (open != null) {
                if (open.getDeliveryBoy().getId().equals(boy.getId())) {
                    // Already assigned to this boy — nothing to change.
                    return enrichOne(order, null);
                }
                throw new ConflictException("This order is already assigned to "
                        + open.getDeliveryBoy().getName() + ". Use Reassign to hand it over.");
            }
        }

        if (open != null) {
            // Close the previous row; it stays in the delivery history.
            open.setStatus(DeliveryAssignmentStatus.REASSIGNED);
            deliveryAssignmentRepository.save(open);
        }

        DeliveryAssignment assignment = new DeliveryAssignment();
        assignment.setOrder(order);
        assignment.setDeliveryBoy(boy);
        assignment.setAssignedBy(admin);
        assignment.setStatus(DeliveryAssignmentStatus.ASSIGNED);
        assignment.setAssignedAt(LocalDateTime.now());
        deliveryAssignmentRepository.save(assignment);

        return enrichOne(order, null);
    }

    /** Closes the open assignment of a cancelled order; history is preserved. */
    @Transactional
    public void cancelAssignmentsFor(Long orderId) {
        for (DeliveryAssignment assignment
                : deliveryAssignmentRepository.findOpenByOrderId(orderId, ACTIVE_ASSIGNMENT_STATUSES)) {
            assignment.setStatus(DeliveryAssignmentStatus.CANCELLED);
            deliveryAssignmentRepository.save(assignment);
        }
    }

    /* ================================================================
       Delivery boy dashboard + actions
       ================================================================ */

    @Transactional(readOnly = true)
    public List<OrderDTO> myDeliveries(String search, DeliveryState filter, LocalDate date) {
        User boy = requireCurrentDeliveryBoy();
        List<Order> orders = orderRepository.searchDeliveryBoard(
                BOARD_STATUSES, normalize(search), boy.getId(),
                date == null ? null : date.atStartOfDay(),
                date == null ? null : date.plusDays(1).atStartOfDay());

        // A delivery boy only ever sees orders whose *open* assignment is his,
        // so an order reassigned to somebody else disappears from his list.
        Set<Long> mine = new HashSet<>(deliveryAssignmentRepository
                .findOrderIdsByDeliveryBoyIdAndStatusIn(boy.getId(), LIVE_ASSIGNMENT_STATUSES));
        orders = orders.stream().filter(o -> mine.contains(o.getId())).collect(Collectors.toList());

        if (filter != null) {
            orders = orders.stream()
                    .filter(o -> deliveryInfoMapper.stateOf(o, true) == filter)
                    .collect(Collectors.toList());
        }
        return enrich(orders, boy);
    }

    /**
     * Today's work list. "Today" is the assignment date, which is what a driver
     * works from; cancelled orders are never part of the result.
     */
    @Transactional(readOnly = true)
    public List<OrderDTO> myTodayDeliveries(String search) {
        User boy = requireCurrentDeliveryBoy();
        String keyword = normalize(search);

        List<Order> orders = deliveryAssignmentRepository
                .findByDeliveryBoyIdAndStatusInAndAssignedAtBetween(
                        boy.getId(), TODAY_STATUSES, startOfToday(), startOfTomorrow())
                .stream()
                .map(DeliveryAssignment::getOrder)
                .filter(o -> o.getStatus() != OrderStatus.CANCELLED)
                .filter(o -> matchesOrder(o, keyword))
                .collect(Collectors.toList());

        return enrich(orders, boy);
    }

    @Transactional(readOnly = true)
    public DeliveryBoySummaryDTO mySummary() {
        User boy = requireCurrentDeliveryBoy();
        DeliveryBoySummaryDTO summary = new DeliveryBoySummaryDTO();
        summary.setPendingDeliveries(deliveryAssignmentRepository.countByDeliveryBoyIdAndStatusIn(
                boy.getId(), EnumSet.of(DeliveryAssignmentStatus.ASSIGNED)));
        summary.setOutForDelivery(deliveryAssignmentRepository.countByDeliveryBoyIdAndStatusIn(
                boy.getId(), EnumSet.of(DeliveryAssignmentStatus.STARTED)));
        summary.setCompletedDeliveries(deliveryAssignmentRepository
                .countByDeliveryBoyIdAndStatus(boy.getId(), DeliveryAssignmentStatus.COMPLETED));
        summary.setTodayDeliveries(
                deliveryAssignmentRepository.countByDeliveryBoyIdAndStatusInAndAssignedAtBetween(
                        boy.getId(), TODAY_STATUSES, startOfToday(), startOfTomorrow()));
        return summary;
    }

    /**
     * A single delivery for the logged-in delivery boy. Ownership is verified
     * against the assignment table, so swapping the id in the URL yields 403.
     */
    @Transactional(readOnly = true)
    public OrderDTO myDeliveryDetail(Long orderId) {
        User boy = requireCurrentDeliveryBoy();
        requireOwnedAssignment(orderId, boy);

        Order order = requireOrder(orderId);
        if (order.getStatus() == OrderStatus.CANCELLED) {
            throw new ConflictException("This order was cancelled.");
        }
        return enrichOne(order, boy);
    }

    @Transactional
    public OrderDTO startDelivery(Long orderId) {
        User boy = requireCurrentDeliveryBoy();
        Order order = requireOrder(orderId);
        DeliveryAssignment assignment = requireOwnedOpenAssignment(orderId, boy);

        if (order.getStatus() == OrderStatus.OUT_FOR_DELIVERY) {
            // Idempotent, so a flaky mobile connection can retry safely.
            markStarted(assignment);
            return enrichOne(order, boy);
        }
        if (order.getStatus() != OrderStatus.READY_FOR_PICKUP) {
            throw new ConflictException("Delivery can only be started once the order is ready for pickup.");
        }

        // Reuses the single existing status-transition rule set, so a delivery
        // boy can never move an order to an arbitrary status.
        orderService.updateOrderStatus(orderId, OrderStatus.OUT_FOR_DELIVERY);

        markStarted(assignment);
        return enrichOne(order, boy);
    }

    @Transactional
    public OrderDTO markDelivered(Long orderId) {
        User boy = requireCurrentDeliveryBoy();
        Order order = requireOrder(orderId);
        DeliveryAssignment assignment = requireOwnedOpenAssignment(orderId, boy);

        if (order.getStatus() == OrderStatus.DELIVERED) {
            if (assignment.getCompletedAt() == null) {
                assignment.setCompletedAt(LocalDateTime.now());
                deliveryAssignmentRepository.save(assignment);
            }
            return enrichOne(order, boy);
        }
        if (order.getStatus() == OrderStatus.CANCELLED) {
            throw new ConflictException("This order was cancelled and cannot be delivered.");
        }
        if (order.getStatus() != OrderStatus.OUT_FOR_DELIVERY) {
            throw new ConflictException("Start the delivery before marking this order as delivered.");
        }

        Payment payment = paymentService.getByOrder(order);
        if (payment == null) {
            throw new ConflictException("This order has no payment record.");
        }
        if (payment.getPaymentStatus() != PaymentStatus.PAID) {
            throw new ConflictException(payment.getPaymentMethod() == PaymentMethod.CASH_ON_DELIVERY
                    ? "Cannot mark COD order as delivered until payment is received."
                    : "Payment for this order is not completed yet.");
        }

        orderService.updateOrderStatus(orderId, OrderStatus.DELIVERED);

        assignment.setCompletedAt(LocalDateTime.now());
        assignment.setStatus(DeliveryAssignmentStatus.COMPLETED);
        deliveryAssignmentRepository.save(assignment);

        return enrichOne(order, boy);
    }

    /**
     * Cash collected at the door. This only touches the payment row — the order
     * stays OUT_FOR_DELIVERY until "Mark Delivered" is pressed separately.
     */
    @Transactional
    public OrderDTO collectCash(Long orderId, String transactionRef) {
        User boy = requireCurrentDeliveryBoy();
        Order order = requireOrder(orderId);
        requireOwnedOpenAssignment(orderId, boy);

        if (order.getStatus() == OrderStatus.CANCELLED) {
            throw new ConflictException("This order was cancelled; no payment can be collected.");
        }
        if (order.getStatus() != OrderStatus.OUT_FOR_DELIVERY) {
            throw new ConflictException("Cash can only be collected while the order is out for delivery.");
        }

        Payment payment = paymentService.getByOrder(order);
        if (payment == null) {
            throw new ConflictException("This order has no payment record.");
        }
        if (payment.getPaymentMethod() == PaymentMethod.ONLINE) {
            throw new ConflictException("This is an online order, so there is no cash to collect.");
        }
        if (payment.getPaymentStatus() == PaymentStatus.PAID) {
            throw new ConflictException("Payment for this order has already been marked as received.");
        }

        // The collected amount is always the order grand total.
        payment.setAmount(order.getGrandTotal());
        paymentService.markPaymentReceived(order, transactionRef);

        return enrichOne(order, boy);
    }

    /* ================================================================
       Helpers
       ================================================================ */

    private List<OrderDTO> enrich(List<Order> orders, User viewer) {
        if (orders.isEmpty()) return List.of();
        Map<Long, DeliveryInfoDTO> info = deliveryInfoMapper.buildAll(orders, viewer);
        return orders.stream()
                .map(o -> {
                    OrderDTO dto = orderService.toDTO(o);
                    dto.setDelivery(info.get(o.getId()));
                    return dto;
                })
                .collect(Collectors.toList());
    }

    private OrderDTO enrichOne(Order order, User viewer) {
        OrderDTO dto = orderService.toDTO(order);
        dto.setDelivery(deliveryInfoMapper.build(order, viewer));
        return dto;
    }

    private void markStarted(DeliveryAssignment assignment) {
        if (assignment.getStartedAt() == null) {
            assignment.setStartedAt(LocalDateTime.now());
        }
        assignment.setStatus(DeliveryAssignmentStatus.STARTED);
        deliveryAssignmentRepository.save(assignment);
    }

    private DeliveryAssignment requireOwnedOpenAssignment(Long orderId, User boy) {
        DeliveryAssignment assignment = findOpenAssignment(orderId)
                .orElseThrow(() -> new ForbiddenException("This order is not assigned for delivery."));
        if (assignment.getDeliveryBoy() == null
                || !assignment.getDeliveryBoy().getId().equals(boy.getId())) {
            throw new ForbiddenException("Only the assigned Delivery Boy can update this delivery.");
        }
        if (!boy.getEnabled()) {
            throw new ForbiddenException("This Delivery Boy account is inactive.");
        }
        return assignment;
    }

    /** Any historical assignment counts, so a delivered order stays visible. */
    private void requireOwnedAssignment(Long orderId, User boy) {
        boolean owns = deliveryAssignmentRepository.findByOrderIdOrderByAssignedAtAsc(orderId).stream()
                .anyMatch(a -> a.getDeliveryBoy() != null
                        && a.getDeliveryBoy().getId().equals(boy.getId()));
        if (!owns) {
            throw new ForbiddenException("Only the assigned Delivery Boy can view this delivery.");
        }
    }

    private Optional<DeliveryAssignment> findOpenAssignment(Long orderId) {
        return deliveryAssignmentRepository
                .findOpenByOrderId(orderId, LIVE_ASSIGNMENT_STATUSES)
                .stream().findFirst();
    }

    private User requireCurrentDeliveryBoy() {
        User user = authService.getCurrentUser();
        if (user.getRole() != Role.DELIVERY_BOY) {
            throw new ForbiddenException("This endpoint is only available to Delivery Boys.");
        }
        return user;
    }

    private User requireDeliveryBoyEntity(Long id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Delivery Boy not found"));
        if (user.getRole() != Role.DELIVERY_BOY) {
            throw new BadRequestException("The selected user is not a Delivery Boy.");
        }
        return user;
    }

    private Order requireOrder(Long orderId) {
        return orderRepository.findById(orderId)
                .orElseThrow(() -> new ResourceNotFoundException("Order not found"));
    }

    private List<Long> idsOf(List<Order> orders) {
        return orders.stream().map(Order::getId).collect(Collectors.toList());
    }

    private boolean matchesOrder(Order order, String keyword) {
        if (keyword == null) return true;
        return contains(order.getOrderNumber(), keyword)
                || contains(order.getCustomerName(), keyword)
                || contains(order.getCustomerPhone(), keyword);
    }

    private boolean contains(String value, String keyword) {
        return value != null && value.toLowerCase(Locale.ROOT).contains(keyword);
    }

    private String normalize(String value) {
        if (value == null) return null;
        String trimmed = value.trim().toLowerCase(Locale.ROOT);
        return trimmed.isEmpty() ? null : trimmed;
    }

    private String require(String value, String message) {
        if (value == null || value.isBlank()) {
            throw new BadRequestException(message);
        }
        return value.trim();
    }

    private LocalDateTime startOfToday() {
        return LocalDate.now().atStartOfDay();
    }

    private LocalDateTime startOfTomorrow() {
        return LocalDate.now().plusDays(1).atStartOfDay();
    }
}
