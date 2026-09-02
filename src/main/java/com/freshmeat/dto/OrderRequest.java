package com.freshmeat.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import lombok.Data;

import java.util.ArrayList;
import java.util.List;

@Data
public class OrderRequest {

    @NotBlank(message = "Full name is required")
    private String customerName;

    @NotBlank(message = "Phone is required")
    @Pattern(regexp = "^[0-9]{10}$", message = "Phone must be 10 digits")
    private String customerPhone;

    @NotBlank(message = "Email is required")
    @Email(message = "Invalid email")
    private String customerEmail;

    @NotBlank(message = "Door number is required")
    private String deliveryDoor;

    @NotBlank(message = "Street is required")
    private String deliveryStreet;

    @NotBlank(message = "Area is required")
    private String deliveryArea;

    @NotBlank(message = "City is required")
    private String deliveryCity;

    @NotBlank(message = "State is required")
    private String deliveryState;

    @NotBlank(message = "Pincode is required")
    @Pattern(regexp = "^[0-9]{6}$", message = "Pincode must be 6 digits")
    private String deliveryPincode;

    @NotBlank(message = "Delivery slot is required")
    private String deliverySlot;

    @NotBlank(message = "Payment method is required")
    private String paymentMethod;

    private String notes;

    private String couponCode;

    private List<Long> cartItemIds = new ArrayList<>();
}
