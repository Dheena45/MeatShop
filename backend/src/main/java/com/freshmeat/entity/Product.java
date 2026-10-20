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
import java.util.ArrayList;
import java.util.List;

/**
 * MongoDB document.
 * <p>
 * The category association is stored twice on purpose: a plain
 * {@code categoryId} (what every filter and dashboard aggregation queries —
 * no extra round trip) plus a lazy {@code @DBRef} for the few code paths that
 * actually need the category document. The custom setter keeps the two in
 * sync, and {@code @AccessType(FIELD)} keeps the Spring Data converter from
 * re-invoking that setter while reading (a lazy DBRef proxy loads its target
 * on any method call, unlike a JPA proxy).
 */
@Document(collection = "products")
@AccessType(AccessType.Type.FIELD)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class Product {

    @Id
    private Long id;

    @Indexed(name = "idx_products_name")
    private String name;

    private String shortDescription;

    private String description;

    private BigDecimal pricePerKg;

    private BigDecimal discountPercent = BigDecimal.ZERO;

    private Integer stockQuantity = 0;

    private Integer minOrderQty = 1;

    private String unit = "KG";

    private String imageUrl;

    private Boolean available = true;

    private Boolean freshToday = true;

    private BigDecimal avgRating = BigDecimal.ZERO;

    private Integer reviewCount = 0;

    /** Plain copy of {@link #category}'s id — what queries and aggregations use. */
    @Indexed(name = "idx_products_category")
    private Long categoryId;

    @DBRef(lazy = true)
    private Category category;

    private List<String> cuttingOptions = new ArrayList<>();

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    /** Keeps the plain {@link #categoryId} in sync with the object reference. */
    public void setCategory(Category category) {
        this.category = category;
        this.categoryId = category == null ? null : category.getId();
    }
}
