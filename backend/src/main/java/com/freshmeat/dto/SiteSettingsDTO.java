package com.freshmeat.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class SiteSettingsDTO {

    private Long id;

    @NotBlank(message = "Premium Cuts value is required")
    @Size(max = 30, message = "Premium Cuts value must be at most 30 characters")
    @Pattern(regexp = "^[0-9]+[Kk]?\\+?$", message = "Enter a value like 500+, 750+, 10K+ or 1000+")
    private String premiumCuts;

    @NotBlank(message = "Happy Customers value is required")
    @Size(max = 30, message = "Happy Customers value must be at most 30 characters")
    @Pattern(regexp = "^[0-9]+[Kk]?\\+?$", message = "Enter a value like 10K+, 15K+ or 20K+")
    private String happyCustomers;
}