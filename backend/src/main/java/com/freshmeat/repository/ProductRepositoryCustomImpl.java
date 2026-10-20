package com.freshmeat.repository;

import com.freshmeat.entity.Category;
import com.freshmeat.entity.Order;
import com.freshmeat.entity.Product;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * {@link ProductRepositoryCustom} implemented with {@link MongoTemplate}.
 * <p>
 * Two of the methods look at more than one collection. Instead of denormalising
 * a category name into every product (which would go stale the moment a
 * category is renamed) the search first resolves matching category ids and then
 * queries products, and the sales report counts order lines from the orders
 * collection.
 * <p>
 * Cross-document comparisons ({@code stockQuantity <= minOrderQty}) are done in
 * memory: the product catalogue is small, and this keeps the query portable
 * instead of depending on a server-side {@code $expr}.
 */
public class ProductRepositoryCustomImpl implements ProductRepositoryCustom {

    private final MongoTemplate mongoTemplate;

    public ProductRepositoryCustomImpl(MongoTemplate mongoTemplate) {
        this.mongoTemplate = mongoTemplate;
    }

    @Override
    public List<Product> fullTextSearch(String keyword) {
        if (keyword == null || keyword.isBlank()) {
            return new ArrayList<>();
        }
        Pattern contains = Pattern.compile(Pattern.quote(keyword), Pattern.CASE_INSENSITIVE);

        List<Long> categoryIds = mongoTemplate.find(
                        Query.query(Criteria.where("name").regex(contains)), Category.class)
                .stream().map(Category::getId).toList();

        Criteria criteria = new Criteria().orOperator(
                Criteria.where("name").regex(contains),
                Criteria.where("shortDescription").regex(contains),
                Criteria.where("description").regex(contains),
                Criteria.where("categoryId").in(categoryIds));
        return mongoTemplate.find(Query.query(criteria), Product.class);
    }

    @Override
    public List<Product> findLowStockProducts() {
        return allProducts().stream()
                .filter(p -> p.getStockQuantity() != null && p.getMinOrderQty() != null
                        && p.getStockQuantity() <= p.getMinOrderQty())
                .toList();
    }

    @Override
    public List<Product> findOutOfStockProducts() {
        return mongoTemplate.find(
                Query.query(Criteria.where("stockQuantity").is(0)), Product.class);
    }

    @Override
    public List<Product> findPopularProducts() {
        List<Product> sellable = mongoTemplate.find(
                Query.query(Criteria.where("available").is(true).and("stockQuantity").gt(0)),
                Product.class);
        if (sellable.isEmpty()) {
            return sellable;
        }

        // How many order lines mention each product: one pass over the orders
        // collection, no N+1 and no denormalised counter to keep in sync.
        Map<Long, Long> salesByProduct = new HashMap<>();
        for (Order order : mongoTemplate.find(new Query(), Order.class)) {
            if (order.getItems() == null) {
                continue;
            }
            order.getItems().forEach(item -> {
                if (item.getProductId() != null) {
                    salesByProduct.merge(item.getProductId(), 1L, Long::sum);
                }
            });
        }

        List<Product> sorted = new ArrayList<>(sellable);
        sorted.sort(Comparator.comparingLong(
                (Product p) -> salesByProduct.getOrDefault(p.getId(), 0L)).reversed());
        return sorted;
    }

    private List<Product> allProducts() {
        return mongoTemplate.find(new Query(), Product.class);
    }
}
