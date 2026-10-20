package com.freshmeat.repository;

import com.freshmeat.entity.Inventory;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface InventoryRepository extends MongoRepository<Inventory, Long>, InventoryRepositoryCustom {

    Optional<Inventory> findByProductId(Long productId);

    List<Inventory> findByCurrentStockLessThanEqual(Integer threshold);

    List<Inventory> findByCurrentStockEquals(Integer stock);

    void deleteByProductId(Long productId);
}
