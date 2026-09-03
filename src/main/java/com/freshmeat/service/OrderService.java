package com.freshmeat.service;

import com.freshmeat.dto.OrderDTO;
import com.freshmeat.dto.OrderLineDTO;
import com.freshmeat.dto.OrderRequest;
import com.freshmeat.entity.*;
import com.freshmeat.enums.OrderStatus;
import com.freshmeat.enums.PaymentMethod;
import com.freshmeat.enums.PaymentStatus;
import com.freshmeat.exception.BadRequestException;
import com.freshmeat.exception.ResourceNotFoundException;
import com.freshmeat.exception.StockException;
import com.freshmeat.exception.UnauthorizedException;
import com.freshmeat.repository.CartItemRepository;
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
import java.util.List;
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

    private static final BigDecimal DELIVERY_CHARGE = new BigDecimal("40");
    private static final BigDecimal FREE_DELIVERY_THRESHOLD = new BigDecimal("499");
    private static final BigDecimal TAX_RATE = new BigDecimal("0.00"); // 0% for simplicity, adjustable

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

        PaymentMethod method;
        if ("ONLINE".equalsIgnoreCase(request.getPaymentMethod())) {
            method = PaymentMethod.ONLINE;
        } else {
            method = PaymentMethod.CASH_ON_DELIVERY;
        }
        paymentService.createPayment(order, method, order.getGrandTotal());

        for (CartItem item : selectedItems) {
            cartItemRepository.delete(item);
        }

        return toDTO(order);
    }

    public OrderDTO getOrderForUser(Long orderId) {
        User user = authService.getCurrentUser();
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new ResourceNotFoundException("Order not found"));
        if (!order.getUser().getId().equals(user.getId()) &&
                !user.getRole().name().equals("ADMIN")) {
            throw new UnauthorizedException("You do not have access to this order");
        }
        return toDTO(order);
    }

    public List<OrderDTO> getMyOrders() {
        User user = authService.getCurrentUser();
        return orderRepository.findByUserIdOrderByCreatedAtDesc(user.getId())
                .stream().map(this::toDTO).collect(Collectors.toList());
    }

    @Transactional
    public void cancelOrder(Long orderId) {
        User user = authService.getCurrentUser();
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new ResourceNotFoundException("Order not found"));
        if (!order.getUser().getId().equals(user.getId())) {
            throw new UnauthorizedException("You do not have access to this order");
        }
        if (order.getStatus() != OrderStatus.PLACED && order.getStatus() != OrderStatus.CONFIRMED) {
            throw new BadRequestException("Order can only be cancelled before it is prepared");
        }

        order.setStatus(OrderStatus.CANCELLED);
        orderRepository.save(order);

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

        if (order.getStatus() == OrderStatus.CANCELLED) {
            throw new BadRequestException("Cannot update a cancelled order");
        }
        if (newStatus == OrderStatus.DELIVERED && order.getStatus() != OrderStatus.OUT_FOR_DELIVERY) {
            throw new BadRequestException("Order must be out for delivery before marked delivered");
        }

        order.setStatus(newStatus);
        orderRepository.save(order);

        if (newStatus == OrderStatus.DELIVERED && order.getPayment() != null
                && order.getPayment().getPaymentStatus() != PaymentStatus.PAID
                && order.getPayment().getPaymentMethod() == PaymentMethod.CASH_ON_DELIVERY) {
            paymentService.markAsPaid(order);
        }

        return toDTO(order);
    }

    public List<OrderDTO> adminSearch(OrderStatus status, String keyword) {
        return orderRepository.search(status, keyword)
                .stream().map(this::toDTO).collect(Collectors.toList());
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

    public boolean userPurchasedProduct(Long userId, Long productId) {
        List<Order> orders = orderRepository.findByUserIdAndStatus(userId, OrderStatus.DELIVERED);
        for (Order order : orders) {
            for (OrderItem item : order.getItems()) {
                if (item.getProduct() != null && item.getProduct().getId().equals(productId)) {
                    return true;
                }
            }
        }
        return false;
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
