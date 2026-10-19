package com.freshmeat.repository;

import com.freshmeat.entity.Invoice;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface InvoiceRepository extends JpaRepository<Invoice, Long> {

    Optional<Invoice> findByOrderId(Long orderId);

    boolean existsByInvoiceNumber(String invoiceNumber);

    long countByInvoiceNumberStartingWith(String prefix);
}