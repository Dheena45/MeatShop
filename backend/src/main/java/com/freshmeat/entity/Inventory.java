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

/**
 * MongoDB document. One inventory row per product is kept by the unique
 * index on {@code productId} (the old {@code product_id} unique constraint).
 */
@Document(collection = "inventory")
@AccessType(AccessType.Type.FIELD)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class Inventory {

    @Id
    private Long id;

    /** Plain copy of {@link #product}'s id — the unique key of this row. */
    @Indexed(name = "idx_inventory_product", unique = true)
    private Long productId;

    @DBRef(lazy = true)
    private Product product;

    private Integer currentStock = 0;

    private Integer minStock = 0;

    private LocalDateTime lastRestockedAt;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    /** Keeps the plain {@link #productId} in sync with the object reference. */
    public void setProduct(Product product) {
        this.product = product;
        this.productId = product == null ? null : product.getId();
    }
}
