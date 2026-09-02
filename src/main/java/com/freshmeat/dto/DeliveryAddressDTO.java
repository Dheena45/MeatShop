package com.freshmeat.dto;

import lombok.Data;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

@Data
public class DeliveryAddressDTO {
    private Long id;
    private String label;
    private String doorNumber;
    private String street;
    private String area;

    @NotBlank(message = "City is required")
    private String city;

    private String state;

    @NotBlank(message = "Pincode is required")
    @Pattern(regexp = "^[0-9]{6}$", message = "Pincode must be 6 digits")
    private String pincode;

    private Boolean isDefault = false;
}
