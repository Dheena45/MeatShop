package com.freshmeat.service;

import com.freshmeat.dto.DeliveryInfoDTO;
import com.freshmeat.dto.OrderDTO;
import com.freshmeat.dto.OrderLineDTO;
import com.freshmeat.dto.OrderRequest;
import com.freshmeat.entity.*;
import com.freshmeat.enums.DeliveryAssignmentStatus;
import com.freshmeat.enums.OrderStatus;
import com.freshmeat.enums.PaymentMethod;
import com.freshmeat.enums.PaymentStatus;
import com.freshmeat.enums.Role;
import com.freshmeat.exception.BadRequestException;
import com.freshmeat.exception.ConflictException;
import com.freshmeat.exception.ResourceNotFoundException;
import com.freshmeat.exception.StockException;
import com.freshmeat.exception.UnauthorizedException;
import com.freshmeat.repository.CartItemRepository;
import com.freshmeat.repository.DeliveryAssignmentRepository;
import com.freshmeat.repository.OrderItemRepository;
import com.freshmeat.repository.OrderRepository;
import com.freshmeat.repository.ProductRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.EnumSet;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class OrderService {

    @Autowired
    private OrderRepository orderRepository;

    @Autowired
    private OrderItemRepository orderItemRepository;

    @Autowired
    private CartService cartService;

    @Autowired
    private CartItemRepository cartItemRepository;

    @Autowired
    private ProductRepository productRepository;

    @Autowired
    private AuthService authService;

    @Autowired
    private PaymentService paymentService;

    @Autowired
    private DeliveryInfoMapper deliveryInfoMapper;

    @Autowired
    private DeliveryAssignmentRepository deliveryAssignmentRepository;

    private static final BigDecimal DELIVERY_CHARGE = new BigDecimal("40");
    private static final BigDecimal FREE_DELIVERY_THRESHOLD = new BigDecimal("499");
    private static final BigDecimal TAX_RATE = new BigDecimal("0.00"); // 0% for simplicity, adjustable

    // Admin status updates must move forward exactly one step on the happy-path
    // sequence; every other transition (jumping ahead, going back, cancelling
    // via status update) is rejected with a 409 Conflict. Cash-on-delivery
    // orders are CONFIRMED as soon as they are placed; online orders stay in
    // PLACED until their payment is confirmed, then move onto the same
    // fulfilment sequence:
    //   PLACED -> CONFIRMED -> PREPARING -> READY_FOR_PICKUP
    //          -> OUT_FOR_DELIVERY -> DELIVERED
    private static final Map<OrderStatus, OrderStatus> NEXT_STATUS = new EnumMap<>(OrderStatus.class);

    /**
     * Assignment rows that count as "an active Delivery Boy is confirmed for
     * this order" when the CONFIRMED -> PREPARING gate is evaluated.
     */
    private static final EnumSet<DeliveryAssignmentStatus> ACTIVE_ASSIGNMENT_STATUSES =
            EnumSet.of(DeliveryAssignmentStatus.ASSIGNED, DeliveryAssignmentStatus.STARTED);

    static {
        NEXT_STATUS.put(OrderStatus.PLACED, OrderStatus.CONFIRMED);
        NEXT_STATUS.put(OrderStatus.CONFIRMED, OrderStatus.PREPARING);
        NEXT_STATUS.put(OrderStatus.PREPARING, OrderStatus.READY_FOR_PICKUP);
        NEXT_STATUS.put(OrderStatus.READY_FOR_PICKUP, OrderStatus.OUT_FOR_DELIVERY);
        NEXT_STATUS.put(OrderStatus.OUT_FOR_DELIVERY, OrderStatus.DELIVERED);
    }

    @Transactional
    public OrderDTO placeOrder(OrderRequest request) {
        User user = authService.getCurrentUser();

        List<CartItem> cartItems = cartService.getActiveCartItems(user);
        if (cartItems.isEmpty()) {
            throw new BadRequestException("Your cart is empty");
        }

        List<CartItem> selectedItems = new ArrayList<>();
        if (request.getCartItemIds() != null && !request.getCartItemIds().isEmpty()) {
            for (CartItem item : cartItems) {
                if (request.getCartItemIds().contains(item.getId())) {
                    selectedItems.add(item);
                }
            }
        } else {
            selectedItems.addAll(cartItems);
        }

        if (selectedItems.isEmpty()) {
            throw new BadRequestException("No items selected for order");
        }

        validateStock(selectedItems);

        BigdecimalHelper helper = calculateTotals(selectedItems, request.getCouponCode());

        Order order = new Order();
        order.setUser(user);
        order.setCustomerName(request.getCustomerName());
        order.setCustomerPhone(request.getCustomerPhone());
        order.setSubtotal(helper.subtotal);
        order.setDiscountAmount(helper.discount);
        order.setDeliveryCharge(deliveryChargeFor(helper.subtotal));
        order.setTax(helper.tax);
        order.setGrandTotal(helper.grandTotal);
        order.setDeliverySlot(request.getDeliverySlot());
        order.setDeliveryDoor(request.getDeliveryDoor());
        order.setDeliveryStreet(request.getDeliveryStreet());
        order.setDeliveryArea(request.getDeliveryArea());
        order.setDeliveryCity(request.getDeliveryCity());
        order.setDeliveryState(request.getDeliveryState());
        order.setDeliveryPincode(request.getDeliveryPincode());
        order.setNotes(request.getNotes());
        order.setOrderNumber(generateOrderNumber());
        order = orderRepository.save(order);

        for (CartItem item : selectedItems) {
            Product product = item.getProduct();
            OrderItem oi = new OrderItem();
            oi.setOrder(order);
            oi.setProduct(product);
            oi.setProductName(product.getName());
            oi.setQuantity(item.getQuantity());
            oi.setCuttingOption(item.getCuttingOption());
            oi.setPricePerKg(item.getUnitPrice());

            BigDecimal lineTotal = item.getUnitPrice().multiply(BigDecimal.valueOf(item.getQuantity()));
            oi.setSubtotal(lineTotal);
            orderItemRepository.save(oi);

            product.setStockQuantity(product.getStockQuantity() - item.getQuantity());
            productRepository.save(product);
        }

        PaymentMethod method = parsePaymentMethod(request.getPaymentMethod());

        // COD is confirmed at the counter. Online orders are NOT confirmed until
        // the payment gateway confirms success (confirmOnlinePayment).
        order.setStatus(method == PaymentMethod.ONLINE ? OrderStatus.PLACED : OrderStatus.CONFIRMED);
        order = orderRepository.save(order);

        order.setPayment(paymentService.createPayment(order, method, order.getGrandTotal()));

        for (CartItem item : selectedItems) {
            cartItemRepository.delete(item);
        }

        return toDTO(order);
    }

    public OrderDTO getOrderForUser(Long orderId) {
        User user = authService.getCurrentUser();
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new ResourceNotFoundException("Order not found"));
        if (order.getUser() != null && order.getUser().getId().equals(user.getId())) {
            return toDTO(order);
        }
        if (user.getRole().name().equals("ADMIN")) {
            return toDTO(order);
        }
        throw new UnauthorizedException("You do not have access to this order");
    }

    public List<OrderDTO> getMyOrders() {
        User user = authService.getCurrentUser();
        return orderRepository.findByUserIdOrderByCreatedAtDesc(user.getId())
                .stream()
                .map(this::toDTO)
                .collect(Collectors.toList());
    }

    /**
     * Admin read of a single order. Unlike {@link #getOrderForUser} this also
     * carries the delivery block (assignment, delivery boy, timestamps) that
     * the admin Orders and Delivery pages display.
     */
    @Transactional(readOnly = true)
    public OrderDTO getOrderForAdmin(Long orderId) {
        User user = authService.getCurrentUser();
        if (user.getRole() != Role.ADMIN) {
            throw new UnauthorizedException("You do not have access to this order");
        }
        Order order = requireOrder(orderId);
        OrderDTO dto = toDTO(order);
        dto.setDelivery(deliveryInfoMapper.build(order, null));
        return dto;
    }

    @Transactional
    public void cancelOrder(Long orderId) {
        User user = authService.getCurrentUser();
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new ResourceNotFoundException("Order not found"));
        if (!order.getUser().getId().equals(user.getId())) {
            throw new UnauthorizedException("You do not have access to this order");
        }
        if (order.getStatus() == OrderStatus.OUT_FOR_DELIVERY) {
            throw new ConflictException("Order cannot be cancelled because it is already out for delivery.");
        }
        if (order.getStatus() == OrderStatus.DELIVERED) {
            throw new ConflictException("Delivered orders cannot be cancelled.");
        }
        if (order.getStatus() == OrderStatus.CANCELLED) {
            throw new ConflictException("Order is already cancelled.");
        }

        applyCancellation(order);
    }

    private void applyCancellation(Order order) {
        order.setStatus(OrderStatus.CANCELLED);
        orderRepository.save(order);

        // A cancelled order must disappear from the delivery board. The
        // assignment rows themselves are kept as history, only their open rows
        // are closed out.
        for (DeliveryAssignment assignment : deliveryAssignmentRepository.findOpenByOrderId(
                order.getId(), EnumSet.of(DeliveryAssignmentStatus.ASSIGNED,
                        DeliveryAssignmentStatus.STARTED))) {
            assignment.setStatus(DeliveryAssignmentStatus.CANCELLED);
            deliveryAssignmentRepository.save(assignment);
        }

        order.getItems().forEach(oi -> {
            Product product = oi.getProduct();
            product.setStockQuantity(product.getStockQuantity() + oi.getQuantity());
            productRepository.save(product);
        });

        if (order.getPayment() != null) {
            order.getPayment().setPaymentStatus(PaymentStatus.CANCELLED);
            paymentService.getByOrder(order);
        }
    }

    @Transactional
    public OrderDTO updateOrderStatus(Long orderId, OrderStatus newStatus) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new ResourceNotFoundException("Order not found"));

        if (newStatus == null) {
            throw new BadRequestException("Order status is required");
        }

        OrderStatus current = order.getStatus();

        // Re-applying the current status is a harmless no-op.
        if (current == newStatus) {
            return toDTO(order);
        }

        // Admin cancellation of CONFIRMED / PREPARING / READY_FOR_PICKUP orders
        // goes through the same stock + payment recovery used by the customer
        // cancel flow.
        if (newStatus == OrderStatus.CANCELLED) {
            if (current == OrderStatus.OUT_FOR_DELIVERY) {
                throw new ConflictException("Order cannot be cancelled because it is already out for delivery.");
            }
            if (current == OrderStatus.DELIVERED) {
                throw new ConflictException("Delivered orders cannot be cancelled.");
            }
            if (current == OrderStatus.CANCELLED) {
                throw new ConflictException("Order is already cancelled.");
            }
            applyCancellation(order);
            return toDTO(order);
        }

        // Terminal states cannot be moved anywhere else.
        if (current == OrderStatus.DELIVERED) {
            throw new ConflictException("Delivered orders cannot be moved to another status.");
        }
        if (current == OrderStatus.CANCELLED) {
            throw new ConflictException("Order is already cancelled.");
        }

        OrderStatus required = previousStatusFor(newStatus);
        if (required == null || current != required) {
            String message = required != null
                    ? "Order must be " + required.name().replace('_', ' ') +
                            " before it can be marked as " + newStatus.name().replace('_', ' ') + "."
                    : "Order cannot be moved from " + current.name().replace('_', ' ') +
                            " to " + newStatus.name().replace('_', ' ') + ".";
            throw new ConflictException(message);
        }

        // CONFIRMED -> PREPARING is the one step that is gated on more than the
        // order status: an active Delivery Boy must already be confirmed for the
        // order. This lives in the service, not in the UI, so a direct call to
        // the admin status endpoint cannot skip the assignment.
        if (current == OrderStatus.CONFIRMED && newStatus == OrderStatus.PREPARING) {
            requireConfirmedDeliveryBoy(order);
        }

        // Payment status is deliberately independent of order status: a
        // cash-on-delivery order can never be marked Delivered while its payment
        // is still pending, and an online order can only get here once the
        // gateway has confirmed it. Collecting cash and marking delivered stay
        // two separate, explicit actions.
        if (newStatus == OrderStatus.DELIVERED && order.getPayment() != null
                && order.getPayment().getPaymentStatus() != PaymentStatus.PAID) {
            throw new ConflictException(order.getPayment().getPaymentMethod() == PaymentMethod.CASH_ON_DELIVERY
                    ? "Cannot mark COD order as delivered until payment is received."
                    : "Payment for this order must be completed before it can be delivered.");
        }

        order.setStatus(newStatus);
        orderRepository.save(order);

        return toDTO(order);
    }

    /**
     * Counter-side cash collection for COD orders. Admin only: a delivery boy
     * collects through {@link DeliveryService#collectCash}, which additionally
     * verifies he is the assigned delivery boy for the order. Marking a payment
     * received never changes the order status.
     */
    @Transactional
    public OrderDTO markPaymentReceived(Long orderId, String transactionRef) {
        User user = authService.getCurrentUser();
        if (user.getRole() != Role.ADMIN) {
            throw new UnauthorizedException("You do not have access to this order");
        }
        Order order = requireOrder(orderId);
        if (order.getPayment() != null && order.getPayment().getPaymentMethod() == PaymentMethod.ONLINE) {
            throw new ConflictException(
                    "Online payments are confirmed by the payment gateway, not marked manually.");
        }
        paymentService.markPaymentReceived(order, transactionRef);
        return toDTO(order);
    }

    /**
     * Finalises the result of an online payment reported by the payment gateway.
     * On success the payment moves PENDING/FAILED -> PAID and the order is
     * confirmed for fulfilment. On failure the payment moves PENDING -> FAILED
     * and the order stays unconfirmed (PLACED) until a retry succeeds.
     */
    @Transactional
    public OrderDTO confirmOnlinePayment(Long orderId, boolean success, String transactionRef) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new ResourceNotFoundException("Order not found"));

        User user = authService.getCurrentUser();
        boolean isOwner = order.getUser() != null && order.getUser().getId().equals(user.getId());
        boolean isAdmin = "ADMIN".equals(user.getRole().name());
        if (!isOwner && !isAdmin) {
            throw new UnauthorizedException("You do not have access to this order");
        }

        if (order.getPayment() == null || order.getPayment().getPaymentMethod() != PaymentMethod.ONLINE) {
            throw new BadRequestException("Only online payment orders are confirmed by the gateway.");
        }
        if (order.getStatus() == OrderStatus.CANCELLED) {
            throw new ConflictException("This order was cancelled and cannot be paid.");
        }

        if (success) {
            paymentService.markOnlinePaid(order, transactionRef);
            // Confirm the order for fulfilment only after payment is confirmed.
            if (order.getStatus() == OrderStatus.PLACED) {
                order.setStatus(OrderStatus.CONFIRMED);
                orderRepository.save(order);
            }
        } else {
            paymentService.markOnlineFailed(order);
        }

        return toDTO(order);
    }

    private PaymentMethod parsePaymentMethod(String raw) {
        if ("ONLINE".equalsIgnoreCase(raw)) {
            return PaymentMethod.ONLINE;
        }
        if ("CASH_ON_DELIVERY".equalsIgnoreCase(raw)) {
            return PaymentMethod.CASH_ON_DELIVERY;
        }
        throw new BadRequestException(
                "Invalid payment method. Choose 'UPI / Online Payment' or 'Cash on Delivery'.");
    }

    private OrderStatus previousStatusFor(OrderStatus target) {
        for (Map.Entry<OrderStatus, OrderStatus> entry : NEXT_STATUS.entrySet()) {
            if (entry.getValue() == target) {
                return entry.getKey();
            }
        }
        return null;
    }

    /**
     * Server-side gate for CONFIRMED -> PREPARING. The order must already carry
     * an open assignment belonging to an enabled Delivery Boy; a deactivated boy
     * does not count. Confirming the Delivery Boy is what links the boy to the
     * order, and it deliberately leaves the order status untouched.
     */
    private void requireConfirmedDeliveryBoy(Order order) {
        boolean confirmed = deliveryAssignmentRepository
                .findOpenByOrderId(order.getId(), ACTIVE_ASSIGNMENT_STATUSES)
                .stream()
                .anyMatch(a -> a.getDeliveryBoy() != null && a.getDeliveryBoy().getEnabled());
        if (!confirmed) {
            throw new ConflictException("Please confirm a Delivery Boy before starting preparation.");
        }
    }

    /**
     * Admin order list. Carries the delivery block so the Orders page can show
     * the assigned delivery boy and the delivery timestamps without an extra
     * request per row. Customer-facing DTOs never include it.
     */
    @Transactional(readOnly = true)
    public List<OrderDTO> adminSearch(OrderStatus status, String keyword) {
        User user = authService.getCurrentUser();
        if (user.getRole() != Role.ADMIN) {
            throw new UnauthorizedException("You do not have access to these orders");
        }
        List<Order> orders = orderRepository.search(status, keyword);
        if (orders.isEmpty()) {
            return List.of();
        }
        Map<Long, DeliveryInfoDTO> delivery = deliveryInfoMapper.buildAll(orders, null);
        return orders.stream().map(order -> {
            OrderDTO dto = toDTO(order);
            dto.setDelivery(delivery.get(order.getId()));
            return dto;
        }).collect(Collectors.toList());
    }

    private Order requireOrder(Long orderId) {
        return orderRepository.findById(orderId)
                .orElseThrow(() -> new ResourceNotFoundException("Order not found"));
    }

    private void validateStock(List<CartItem> items) {
        for (CartItem item : items) {
            Product product = item.getProduct();
            if (!product.getAvailable()) {
                throw new BadRequestException(product.getName() + " is no longer available");
            }
            if (item.getQuantity() > product.getStockQuantity()) {
                throw new StockException("Only " + product.getStockQuantity() + " KG of " +
                        product.getName() + " available in stock");
            }
        }
    }

    private BigdecimalHelper calculateTotals(List<CartItem> items, String couponCode) {
        BigDecimal subtotal = BigDecimal.ZERO;
        BigDecimal discount = BigDecimal.ZERO;

        for (CartItem item : items) {
            BigDecimal originalPrice = productRepository.findById(item.getProduct().getId())
                    .orElseThrow().getPricePerKg();
            BigDecimal lineOriginal = originalPrice.multiply(BigDecimal.valueOf(item.getQuantity()));
            subtotal = subtotal.add(lineOriginal);
            discount = discount.add(lineOriginal.subtract(item.getSubtotal()));
        }

        BigDecimal discountedSubtotal = subtotal.subtract(discount);
        BigDecimal deliveryCharge = deliveryChargeFor(discountedSubtotal);
        BigDecimal tax = discountedSubtotal.multiply(TAX_RATE).setScale(2, RoundingMode.HALF_UP);
        BigDecimal grandTotal = discountedSubtotal.add(deliveryCharge).add(tax);

        BigdecimalHelper helper = new BigdecimalHelper();
        helper.subtotal = subtotal;
        helper.discount = discount;
        helper.deliveryCharge = deliveryCharge;
        helper.tax = tax;
        helper.grandTotal = grandTotal;
        return helper;
    }

    private BigDecimal deliveryChargeFor(BigDecimal subtotal) {
        if (subtotal.compareTo(FREE_DELIVERY_THRESHOLD) >= 0) {
            return BigDecimal.ZERO;
        }
        return DELIVERY_CHARGE;
    }

    private static final SecureRandom RANDOM = new SecureRandom();

    private String generateOrderNumber() {
        DateTimeFormatter dateFormatter = DateTimeFormatter.ofPattern("yyyyMMdd");
        String datePart = LocalDateTime.now().format(dateFormatter);

        int attempt = 0;
        while (true) {
            int randomSeq = 1000 + RANDOM.nextInt(9000);
            String candidate = "FM-" + datePart + "-" + randomSeq;
            if (!orderRepository.existsByOrderNumber(candidate)) {
                return candidate;
            }
            if (++attempt > 20) {
                throw new IllegalStateException("Could not generate a unique order number");
            }
        }
    }

    public OrderDTO toDTO(Order order) {
        OrderDTO dto = new OrderDTO();
        dto.setId(order.getId());
        dto.setOrderNumber(order.getOrderNumber());
        dto.setCustomerName(order.getCustomerName());
        dto.setCustomerPhone(order.getCustomerPhone());
        dto.setStatus(order.getStatus().name());
        dto.setSubtotal(order.getSubtotal());
        dto.setDiscountAmount(order.getDiscountAmount());
        dto.setDeliveryCharge(order.getDeliveryCharge());
        dto.setTax(order.getTax());
        dto.setGrandTotal(order.getGrandTotal());
        dto.setDeliverySlot(order.getDeliverySlot());
        dto.setDeliveryDoor(order.getDeliveryDoor());
        dto.setDeliveryStreet(order.getDeliveryStreet());
        dto.setDeliveryArea(order.getDeliveryArea());
        dto.setDeliveryCity(order.getDeliveryCity());
        dto.setDeliveryState(order.getDeliveryState());
        dto.setDeliveryPincode(order.getDeliveryPincode());
        dto.setNotes(order.getNotes());
        dto.setPaymentMethod(order.getPayment() != null ? order.getPayment().getPaymentMethod().name() : null);
        dto.setPaymentStatus(order.getPayment() != null ? order.getPayment().getPaymentStatus().name() : null);
        dto.setPaidAt(order.getPayment() != null ? order.getPayment().getPaidAt() : null);
        dto.setTransactionRef(order.getPayment() != null ? order.getPayment().getTransactionRef() : null);
        dto.setPaidAmount(order.getPayment() != null && order.getPayment().getPaymentStatus() == PaymentStatus.PAID
                ? order.getPayment().getAmount() : null);
        dto.setCreatedAt(order.getCreatedAt());
        dto.setUpdatedAt(order.getUpdatedAt());

        List<OrderLineDTO> lines = new ArrayList<>();
        if (order.getItems() != null) {
            for (OrderItem oi : order.getItems()) {
                OrderLineDTO line = new OrderLineDTO();
                line.setId(oi.getId());
                line.setProductId(oi.getProduct() != null ? oi.getProduct().getId() : null);
                line.setProductName(oi.getProductName());
                line.setProductImage(oi.getProduct() != null ? oi.getProduct().getImageUrl() : null);
                line.setQuantity(oi.getQuantity());
                line.setCuttingOption(oi.getCuttingOption());
                line.setPricePerKg(oi.getPricePerKg());
                line.setSubtotal(oi.getSubtotal());
                lines.add(line);
            }
        }
        dto.setItems(lines);
        return dto;
    }

    // Billable totals helper
    private static class BigdecimalHelper {
        BigDecimal subtotal;
        BigDecimal discount;
        BigDecimal deliveryCharge;
        BigDecimal tax;
        BigDecimal grandTotal;
    }
}
