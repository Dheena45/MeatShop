package com.freshmeat.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class ContactSettingsDTO {

    private Long id;

    @Size(max = 2000, message = "Business description must be at most 2000 characters")
    private String businessDescription;

    @NotBlank(message = "Address is required")
    @Size(max = 2000, message = "Address must be at most 2000 characters")
    private String address;

    @NotBlank(message = "Phone number is required")
    @Pattern(regexp = "^\\+?[0-9\\s\\-()]{7,20}$", message = "Enter a valid phone number")
    private String phone;

    @NotBlank(message = "Email is required")
    @Email(message = "Enter a valid email address")
    @Size(max = 150, message = "Email must be at most 150 characters")
    private String email;

    @NotBlank(message = "Business hours are required")
    @Size(max = 100, message = "Business hours must be at most 100 characters")
    private String businessHours;

    @Size(max = 300, message = "Facebook URL must be at most 300 characters")
    @Pattern(regexp = "^(|https?://.+)$", message = "Facebook URL must start with http(s)://")
    private String facebookUrl;

    @Size(max = 300, message = "Instagram URL must be at most 300 characters")
    @Pattern(regexp = "^(|https?://.+)$", message = "Instagram URL must start with http(s)://")
    private String instagramUrl;

    @Size(max = 300, message = "X/Twitter URL must be at most 300 characters")
    @Pattern(regexp = "^(|https?://.+)$", message = "X/Twitter URL must start with http(s)://")
    private String twitterUrl;

    @Size(max = 300, message = "YouTube URL must be at most 300 characters")
    @Pattern(regexp = "^(|https?://.+)$", message = "YouTube URL must start with http(s)://")
    private String youtubeUrl;
}