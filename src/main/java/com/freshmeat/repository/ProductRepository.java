package com.freshmeat.repository;

import com.freshmeat.entity.Product;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface ProductRepository extends JpaRepository<Product, Long>, JpaSpecificationExecutor<Product> {

    List<Product> findByCategoryIdAndAvailableTrue(Long categoryId);

    List<Product> findByAvailableTrue();

    List<Product> findByFreshTodayTrueAndAvailableTrue();

    List<Product> findTop8ByAvailableTrueOrderByReviewCountDesc();

    @Query("SELECT p FROM Product p WHERE p.available = true AND p.stockQuantity > 0 " +
           "ORDER BY (SELECT COUNT(oi.id) FROM OrderItem oi WHERE oi.product.id = p.id) DESC")
    List<Product> findPopularProducts();

    @Query("SELECT p FROM Product p WHERE p.stockQuantity <= p.minOrderQty")
    List<Product> findLowStockProducts();

    @Query("SELECT p FROM Product p WHERE p.stockQuantity = 0")
    List<Product> findOutOfStockProducts();

    @Query("SELECT p FROM Product p WHERE LOWER(p.name) LIKE LOWER(CONCAT('%', :keyword, '%')) " +
           "OR LOWER(p.shortDescription) LIKE LOWER(CONCAT('%', :keyword, '%')) " +
           "OR LOWER(p.description) LIKE LOWER(CONCAT('%', :keyword, '%')) " +
           "OR LOWER(p.category.name) LIKE LOWER(CONCAT('%', :keyword, '%'))")
    List<Product> fullTextSearch(@Param("keyword") String keyword);
}
