package com.freshmeat.repository;

import com.freshmeat.entity.Payment;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface PaymentRepository extends JpaRepository<Payment, Long> {

    Optional<Payment> findByOrderId(Long orderId);

    /** Batch lookup so delivery lists can be enriched without N+1 queries. */
    List<Payment> findByOrderIdIn(Collection<Long> orderIds);
}
