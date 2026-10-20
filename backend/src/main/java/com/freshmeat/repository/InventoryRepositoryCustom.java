package com.freshmeat.repository;

import com.freshmeat.entity.Inventory;

import java.util.List;

/**
 * The two "reorder" reports compare a row's stock against its own minimum —
 * a comparison between two fields of the same document, which a derived query
 * cannot express. They are hand-written instead (see the implementation).
 */
public interface InventoryRepositoryCustom {

    /** Rows that still have stock but have reached their reorder level. */
    List<Inventory> findLowStockInventory();

    /** Rows whose stock has run out. */
    List<Inventory> findOutOfStockInventory();
}
