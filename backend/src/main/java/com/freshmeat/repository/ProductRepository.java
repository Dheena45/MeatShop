package com.freshmeat.repository;

import com.freshmeat.entity.Product;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

/**
 * The JPA {@code Specification} executor has no Mongo equivalent, so the
 * dashboard's dynamic filter is built with {@code MongoTemplate} in
 * {@code ProductService} instead of being declared here; everything in this
 * interface is a plain derived query.
 */
public interface ProductRepository extends MongoRepository<Product, Long>, ProductRepositoryCustom {

    List<Product> findByCategoryIdAndAvailableTrue(Long categoryId);

    long countByCategoryId(Long categoryId);

    List<Product> findByAvailableTrue();

    long countByAvailable(boolean available);

    List<Product> findByFreshTodayTrueAndAvailableTrue();

    List<Product> findTop8ByAvailableTrueOrderByReviewCountDesc();
}
