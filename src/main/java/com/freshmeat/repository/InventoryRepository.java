package com.freshmeat.repository;

import com.freshmeat.entity.Inventory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface InventoryRepository extends JpaRepository<Inventory, Long> {

    Optional<Inventory> findByProductId(Long productId);

    List<Inventory> findByCurrentStockLessThanEqual(Integer threshold);

    List<Inventory> findByCurrentStockEquals(Integer stock);

    @Query("SELECT i FROM Inventory i WHERE i.currentStock > 0 AND i.currentStock <= i.minStock")
    List<Inventory> findLowStockInventory();

    @Query("SELECT i FROM Inventory i WHERE i.currentStock <= 0")
    List<Inventory> findOutOfStockInventory();

    @Modifying
    @Query("DELETE FROM Inventory i WHERE i.product.id = :productId")
    void deleteByProductId(@Param("productId") Long productId);
}
