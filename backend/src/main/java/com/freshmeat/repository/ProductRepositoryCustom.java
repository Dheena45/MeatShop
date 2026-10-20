package com.freshmeat.repository;

import com.freshmeat.entity.Product;

import java.util.List;

/**
 * Queries that need more than one collection or a cross-field comparison:
 * full-text search (which also matches the category name) and the stock
 * reports whose threshold is a field of the same document.
 */
public interface ProductRepositoryCustom {

    /**
     * Case-insensitive contains over name, short description and description,
     * plus every product whose category name matches.
     */
    List<Product> fullTextSearch(String keyword);

    /** Products whose stock fell to or below their own minimum order quantity. */
    List<Product> findLowStockProducts();

    /** Products whose stock has run out. */
    List<Product> findOutOfStockProducts();

    /** Available, in-stock products, most ordered first. */
    List<Product> findPopularProducts();
}
