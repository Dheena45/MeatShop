package com.freshmeat.entity;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.annotation.AccessType;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

/**
 * MongoDB document — kept as its own collection (invoices are generated
 * independently of order loads and are never embedded into the order).
 * <p>
 * The order association is a plain {@code orderId}: {@code InvoiceService}
 * loads the order through {@code OrderRepository} when it needs to build a
 * DTO, which also means an invoice never drags an entire order (with its
 * embedded items) into memory just to print its number.
 */
@Document(collection = "invoices")
@AccessType(AccessType.Type.FIELD)
@Getter
@Setter
@NoArgsConstructor
public class Invoice {

    @Id
    private Long id;

    @Indexed(name = "idx_invoices_order", unique = true)
    private Long orderId;

    @Indexed(name = "idx_invoices_number", unique = true)
    private String invoiceNumber;

    private LocalDateTime invoiceDate;

    private LocalDateTime createdAt;
}
