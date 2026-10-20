package com.freshmeat.repository;

import com.freshmeat.entity.Category;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

/**
 * All methods are plain derived queries — every filter uses a stored field, and
 * name lookups stay case-sensitive/insensitive exactly as they were on MySQL.
 */
public interface CategoryRepository extends MongoRepository<Category, Long> {

    Optional<Category> findByName(String name);

    Optional<Category> findByNameIgnoreCase(String name);

    boolean existsByName(String name);

    List<Category> findByActiveTrueOrderByNameAsc();

    long countByActiveTrue();
}
