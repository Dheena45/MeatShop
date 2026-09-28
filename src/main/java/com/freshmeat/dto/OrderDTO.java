package com.freshmeat.dto;

import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Data
public class OrderDTO {
    private Long id;
    private String orderNumber;
    private String customerName;
    private String customerPhone;
    private String status;
    private BigDecimal subtotal;
    private BigDecimal discountAmount;
    private BigDecimal deliveryCharge;
    private BigDecimal tax;
    private BigDecimal grandTotal;
    private String deliverySlot;
    private String deliveryDoor;
    private String deliveryStreet;
    private String deliveryArea;
    private String deliveryCity;
    private String deliveryState;
    private String deliveryPincode;
    private String notes;
    private String paymentMethod;
    private String paymentStatus;
    private BigDecimal paidAmount;
    private LocalDateTime paidAt;
    private String transactionRef;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private List<OrderLineDTO> items = new ArrayList<>();
    /**
     * Delivery information (assignment, timestamps, delivery boy). Populated for
     * admin responses and for the delivery boy who owns the order; always null
     * for customer responses so internal delivery data is not exposed.
     */
    private DeliveryInfoDTO delivery;
}
