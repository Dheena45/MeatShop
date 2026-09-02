package com.freshmeat.repository;

import com.freshmeat.entity.DeliveryAddress;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface DeliveryAddressRepository extends JpaRepository<DeliveryAddress, Long> {

    List<DeliveryAddress> findByUserIdOrderByIsDefaultDescCreatedAtDesc(Long userId);
}
