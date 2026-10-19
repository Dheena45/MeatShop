package com.freshmeat.enums;

public enum Role {
    CUSTOMER,
    ADMIN,
    // Delivery staff. Reuses the existing users table + JWT auth, but is
    // authorised only for /api/delivery/** so a delivery boy can never reach
    // product, category, customer, settings or any other admin endpoint.
    DELIVERY_BOY
}
