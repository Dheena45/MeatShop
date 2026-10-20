package com.freshmeat.entity;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.annotation.AccessType;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

/**
 * MongoDB document. The {@code products} back-reference is gone: products now
 * carry a plain {@code categoryId} (plus a lazy DBRef), so nothing reads a
 * collection that is about to be deleted anyway — deletion stays a lookup on
 * {@code products} instead of an in-memory cascade.
 */
@Document(collection = "categories")
@AccessType(AccessType.Type.FIELD)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class Category {

    @Id
    private Long id;

    @Indexed(name = "idx_categories_name", unique = true)
    private String name;

    private String description;

    private String imageUrl;

    private Boolean active = true;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;
}
