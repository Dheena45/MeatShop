package com.freshmeat.dto;

import jakarta.validation.constraints.NotNull;

/** Soft activate / deactivate payload — delivery boys are never hard-deleted. */
public class DeliveryBoyStatusRequest {

    @NotNull(message = "Active flag is required")
    private Boolean active;

    public Boolean getActive() { return active; }
    public void setActive(Boolean active) { this.active = active; }
}
