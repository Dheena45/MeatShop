package com.freshmeat.entity;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.annotation.AccessType;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.DBRef;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * One line of an order — <b>embedded</b> inside its {@link Order} document, so
 * it has no repository and no {@code order} back-reference.
 * <p>
 * Id and {@code createdAt} are assigned explicitly where the item is built
 * (the Mongo lifecycle callback only sees the root of a save, never embedded
 * value objects). Ids stay numeric so {@code OrderItemDTO.id} and every API
 * payload keep the shape they had on MySQL.
 * <p>
 * The product is a plain {@code productId} plus a lazy {@code @DBRef}; the
 * custom setter keeps them in sync (called explicitly by OrderService —
 * Mongo's converter reads embedded fields directly).
 */
@AccessType(AccessType.Type.FIELD)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class OrderItem {

    @Id
    private Long id;

    /** Plain copy of {@link #product}'s id — survives even if the product is deleted. */
    private Long productId;

    @DBRef(lazy = true)
    private Product product;

    private String productName;

    private Integer quantity;

    private String cuttingOption;

    private BigDecimal pricePerKg;

    private BigDecimal subtotal;

    private LocalDateTime createdAt;

    /** Keeps the plain {@link #productId} in sync with the object reference. */
    public void setProduct(Product product) {
        this.product = product;
        this.productId = product == null ? null : product.getId();
    }
}
