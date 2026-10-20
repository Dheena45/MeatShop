package com.freshmeat.repository;

import com.freshmeat.entity.Order;
import com.freshmeat.enums.OrderStatus;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;

/**
 * Reporting queries that a derived query cannot express: an optional
 * status/keyword search and the revenue aggregations (grouping by month/day and
 * summing money). See {@link OrderRepositoryCustomImpl}.
 */
public interface OrderRepositoryCustom {

    /** Admin order list: both filters optional, newest first. */
    List<Order> search(OrderStatus status, String keyword);

    /** Orders in the given states, newest first. */
    List<Order> findAllOrdersBetween(LocalDateTime start, LocalDateTime end);

    /** Orders that count towards revenue in the window, newest first. */
    List<Order> findRevenueOrdersBetween(LocalDateTime start, LocalDateTime end);

    /**
     * Revenue booked in the window: everything except {@code PLACED} and
     * {@code CANCELLED} (both window ends inclusive, as the old SQL {@code BETWEEN}
     * was). Returns zero for an empty window.
     */
    Double sumRevenueBetween(LocalDateTime start, LocalDateTime end);

    /** Revenue booked in the window, excluding only {@code CANCELLED}. */
    Double sumRevenue(LocalDateTime start, LocalDateTime end);

    /** Revenue of every delivered order, ever. */
    Double sumDeliveredRevenue();

    /** How many orders are in each state inside the window. */
    List<Object[]> countByStatusBetween(LocalDateTime start, LocalDateTime end);

    /** Revenue per calendar month: {@code [year, month, revenue, count]}. */
    List<Object[]> revenueByMonthBetween(LocalDateTime start, LocalDateTime end);

    /** Revenue per calendar day: {@code [LocalDate, revenue, count]}. */
    List<Object[]> revenueByDayBetween(LocalDateTime start, LocalDateTime end);

    /**
     * Delivery board: orders in any of {@code statuses}, optionally narrowed by
     * keyword/date and by "currently assigned to this delivery boy".
     */
    List<Order> searchDeliveryBoard(Collection<OrderStatus> statuses, String keyword,
                                    Long deliveryBoyId, LocalDateTime from, LocalDateTime to);

    // ------------------------------------------------------------------
    // Order-item reporting. The line items now live inside each order
    // document, so what used to be OrderItemRepository queries are
    // unwound over the embedded array here. Each row keeps the
    // {@code Object[]} shape the old JPQL returned.
    // ------------------------------------------------------------------

    /** Top sellers ever: {@code [productId, productName, quantity]}. */
    List<Object[]> findTopSellingProducts();

    /**
     * Top sellers in the window, {@code CANCELLED} orders excluded:
     * {@code [productId, productName, quantity, subtotal]}.
     */
    List<Object[]> findTopSellingProductsBetween(LocalDateTime start, LocalDateTime end);

    /** Quantity and money per product category, ever: {@code [categoryId, quantity, subtotal]}. */
    List<Object[]> findCategoryWiseSales();

    /**
     * Quantity and money per product category in the window, {@code CANCELLED}
     * orders excluded: {@code [categoryId, quantity, subtotal]}.
     */
    List<Object[]> findCategoryWiseSalesBetween(LocalDateTime start, LocalDateTime end);

    /**
     * Line items of the window for the order drill-down, {@code CANCELLED}
     * orders excluded: {@code [orderNumber, productName, quantity]}, ordered by
     * order id then item id.
     */
    List<Object[]> findContributingOrderItemsBetween(LocalDateTime start, LocalDateTime end);

    /**
     * Units sold in the window: everything except {@code PLACED} and
     * {@code CANCELLED}.
     */
    long sumQuantitySoldBetween(LocalDateTime start, LocalDateTime end);

    /**
     * Orders in the window that contain the given product, everything except
     * {@code PLACED} and {@code CANCELLED}, newest first. Used for the
     * per-product sales panel, where each order contributes one row.
     */
    List<Order> findOrdersForProductBetween(Long productId, LocalDateTime start, LocalDateTime end);
}
