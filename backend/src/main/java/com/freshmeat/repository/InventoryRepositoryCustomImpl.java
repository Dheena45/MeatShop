package com.freshmeat.repository;

import com.freshmeat.entity.Inventory;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;

import java.util.List;

/**
 * {@link InventoryRepositoryCustom} implemented with {@link MongoTemplate}.
 * <p>
 * The comparison is between two fields of the same document, so it is done in
 * memory: there is exactly one inventory row per product, so the scan is the
 * size of the catalogue.
 */
public class InventoryRepositoryCustomImpl implements InventoryRepositoryCustom {

    private final MongoTemplate mongoTemplate;

    public InventoryRepositoryCustomImpl(MongoTemplate mongoTemplate) {
        this.mongoTemplate = mongoTemplate;
    }

    @Override
    public List<Inventory> findLowStockInventory() {
        return mongoTemplate.find(new Query(), Inventory.class).stream()
                .filter(i -> i.getCurrentStock() != null && i.getMinStock() != null
                        && i.getCurrentStock() > 0 && i.getCurrentStock() <= i.getMinStock())
                .toList();
    }

    @Override
    public List<Inventory> findOutOfStockInventory() {
        return mongoTemplate.find(
                Query.query(Criteria.where("currentStock").lte(0)), Inventory.class);
    }
}
