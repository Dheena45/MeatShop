package com.freshmeat.dto;

import jakarta.validation.constraints.*;
import lombok.Data;

@Data
public class RegisterRequest {

    @NotBlank(message = "Full name is required")
    @Size(min = 2, max = 100, message = "Full name must be between 2 and 100 characters")
    @Pattern(regexp = "^[\\p{L}][\\p{L} .'-]{1,99}$",
            message = "Please enter a valid full name (letters and spaces only)")
    private String name;

    @NotBlank(message = "Email address is required")
    @Size(max = 150, message = "Email address must not exceed 150 characters")
    @Pattern(regexp = "^[a-z0-9._%+-]+@gmail\\.com$",
            message = "Email must contain only lowercase letters and use @gmail.com.")
    private String email;

    @NotBlank(message = "Mobile number is required")
    @Pattern(regexp = "^[6-9][0-9]{9}$", message = "Please enter a valid 10-digit mobile number.")
    private String phone;

    @NotBlank(message = "Password is required")
    @Size(min = 6, message = "Password must contain at least 6 characters.")
    private String password;

    @NotBlank(message = "Please confirm your password")
    @Size(min = 6, message = "Password must contain at least 6 characters.")
    private String confirmPassword;
}