package com.freshmeat.entity;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.annotation.AccessType;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.DBRef;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

@Document(collection = "delivery_addresses")
@AccessType(AccessType.Type.FIELD)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class DeliveryAddress {

    @Id
    private Long id;

    /** Plain copy of {@link #user}'s id — what every address query filters on. */
    @Indexed(name = "idx_address_user")
    private Long userId;

    @DBRef(lazy = true)
    private User user;

    private String label;

    private String doorNumber;

    private String street;

    private String area;

    private String city;

    private String state;

    private String pincode;

    private Boolean isDefault = false;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    /** Keeps the plain {@link #userId} in sync with the object reference. */
    public void setUser(User user) {
        this.user = user;
        this.userId = user == null ? null : user.getId();
    }
}
