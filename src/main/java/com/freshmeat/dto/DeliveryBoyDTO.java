package com.freshmeat.dto;

import lombok.Data;

import java.time.LocalDateTime;

/**
 * A delivery boy as seen by the admin. The password is never part of this DTO.
 * Counts are computed from the append-only delivery_assignments table, so they
 * stay correct after a delivery boy is deactivated.
 */
@Data
public class DeliveryBoyDTO {
    private Long id;
    private String name;
    private String email;
    private String phone;
    /** Always DELIVERY_BOY here, but returned so the client never has to assume. */
    private String role;
    private Boolean active;
    private LocalDateTime createdAt;
    /** Open assignments (assigned + out for delivery). */
    private long assignedCount;
    /** Assignments whose delivery has been completed, all time. */
    private long completedCount;
    /** Assignments completed today. */
    private long completedTodayCount;
}
