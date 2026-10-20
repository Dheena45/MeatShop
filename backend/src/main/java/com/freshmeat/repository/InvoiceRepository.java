package com.freshmeat.repository;

import com.freshmeat.entity.Invoice;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.Optional;

public interface InvoiceRepository extends MongoRepository<Invoice, Long> {

    Optional<Invoice> findByOrderId(Long orderId);

    boolean existsByInvoiceNumber(String invoiceNumber);

    long countByInvoiceNumberStartingWith(String prefix);
}
