package com.freshmeat.repository;

import com.freshmeat.entity.Inventory;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface InventoryRepository extends JpaRepository<Inventory, Long> {

    Optional<Inventory> findByProductId(Long productId);

    List<Inventory> findByCurrentStockLessThanEqual(Integer threshold);

    List<Inventory> findByCurrentStockEquals(Integer stock);
}
