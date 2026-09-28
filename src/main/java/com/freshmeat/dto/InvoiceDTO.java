package com.freshmeat.dto;

import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Data
public class InvoiceDTO {
    private Long id;
    private String invoiceNumber;
    private LocalDateTime invoiceDate;
    private Long orderId;
    private String orderNumber;
    private LocalDateTime orderDate;
    private String customerName;
    private String customerEmail;
    private String customerPhone;
    private String deliveryDoor;
    private String deliveryStreet;
    private String deliveryArea;
    private String deliveryCity;
    private String deliveryState;
    private String deliveryPincode;
    private String deliverySlot;
    private String notes;
    private BigDecimal subtotal;
    private BigDecimal discountAmount;
    private BigDecimal deliveryCharge;
    private BigDecimal tax;
    private BigDecimal grandTotal;
    private String paymentMethod;
    private String paymentStatus;
    private LocalDateTime paidAt;
    private String orderStatus;
    private String storeName;
    private String storeTagline;
    private String storeAddress;
    private String storePhone;
    private String storeEmail;
    private String storeHours;
    private List<InvoiceLineDTO> items = new ArrayList<>();
}