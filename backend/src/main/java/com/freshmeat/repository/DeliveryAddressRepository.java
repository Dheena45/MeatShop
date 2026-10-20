package com.freshmeat.repository;

import com.freshmeat.entity.DeliveryAddress;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface DeliveryAddressRepository extends MongoRepository<DeliveryAddress, Long> {

    List<DeliveryAddress> findByUserIdOrderByIsDefaultDescCreatedAtDesc(Long userId);

    void deleteByUserId(Long userId);
}
