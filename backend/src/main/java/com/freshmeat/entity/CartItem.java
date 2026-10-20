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

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * MongoDB document.
 * <p>
 * The cart association is a plain {@code cartId} only (no DBRef): the owning
 * side of the old JPA relation was the cart item, and every query on it is a
 * plain "which items are in cart X" — never a path that needs to walk back up
 * to the cart object. The product keeps the standard pair of plain
 * {@code productId} + lazy DBRef with a syncing setter.
 */
@Document(collection = "cart_items")
@AccessType(AccessType.Type.FIELD)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class CartItem {

    @Id
    private Long id;

    @Indexed(name = "idx_cart_items_cart")
    private Long cartId;

    @Indexed(name = "idx_cart_items_product")
    private Long productId;

    @DBRef(lazy = true)
    private Product product;

    private Integer quantity = 1;

    private String cuttingOption;

    private BigDecimal unitPrice;

    private BigDecimal subtotal;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    /** Keeps the plain {@link #productId} in sync with the object reference. */
    public void setProduct(Product product) {
        this.product = product;
        this.productId = product == null ? null : product.getId();
    }
}
