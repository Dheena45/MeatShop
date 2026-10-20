package com.freshmeat.entity;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.annotation.AccessType;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Document(collection = "offers")
@AccessType(AccessType.Type.FIELD)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class Offer {

    @Id
    private Long id;

    private String title;

    private String description;

    private BigDecimal discountPercent;

    private String code;

    @Indexed(name = "idx_offers_product")
    private Long productId;

    @Indexed(name = "idx_offers_category")
    private Long categoryId;

    private LocalDate startDate;

    private LocalDate endDate;

    private Boolean active = true;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;
}
