package com.freshmeat.repository;

import com.freshmeat.entity.DeliveryAssignment;
import com.freshmeat.entity.Order;
import com.freshmeat.enums.DeliveryAssignmentStatus;
import com.freshmeat.enums.OrderStatus;
import org.bson.Document;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.aggregation.Aggregation;
import org.springframework.data.mongodb.core.aggregation.AggregationOperation;
import org.springframework.data.mongodb.core.aggregation.AggregationResults;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.regex.Pattern;

/**
 * {@link OrderRepositoryCustom} implemented with {@link MongoTemplate}.
 * <p>
 * Points worth knowing:
 * <ul>
 *   <li>money is summed in the database; empty windows return no bucket at all,
 *       which is exactly what the old {@code GROUP BY} did, and the service
 *       layer treats a missing bucket as zero;</li>
 *   <li>stored {@code LocalDateTime}s are written through the system default
 *       zone, so month/day buckets are asked for in that same zone — otherwise
 *       Mongo would group by UTC and a 00:30 order would land in the previous
 *       day;</li>
 *   <li>the delivery board used to reach the assignment table through a JPA
 *       subquery; here the two collections are queried in sequence and the
 *       result is filtered in memory, which keeps the "currently assigned to
 *       this boy" rule (the newest open assignment wins) in one place.</li>
 * </ul>
 */
public class OrderRepositoryCustomImpl implements OrderRepositoryCustom {

    private static final ZoneId REPORT_ZONE = ZoneId.systemDefault();

    private final MongoTemplate mongoTemplate;

    public OrderRepositoryCustomImpl(MongoTemplate mongoTemplate) {
        this.mongoTemplate = mongoTemplate;
    }

    @Override
    public List<Order> search(OrderStatus status, String keyword) {
        List<Criteria> filters = new ArrayList<>();
        if (status != null) {
            filters.add(Criteria.where("status").is(status));
        }
        if (keyword != null && !keyword.isBlank()) {
            Pattern contains = Pattern.compile(Pattern.quote(keyword), Pattern.CASE_INSENSITIVE);
            filters.add(new Criteria().orOperator(
                    Criteria.where("orderNumber").regex(contains),
                    Criteria.where("customerName").regex(contains),
                    Criteria.where("customerPhone").regex(contains)));
        }
        Query query = filters.isEmpty()
                ? new Query()
                : Query.query(new Criteria().andOperator(filters.toArray(new Criteria[0])));
        query.with(Sort.by(Sort.Direction.DESC, "createdAt"));
        return mongoTemplate.find(query, Order.class);
    }

    @Override
    public List<Order> findAllOrdersBetween(LocalDateTime start, LocalDateTime end) {
        Query query = Query.query(Criteria.where("createdAt").gte(start).lt(end))
                .with(Sort.by(Sort.Direction.DESC, "createdAt"));
        return mongoTemplate.find(query, Order.class);
    }

    @Override
    public List<Order> findRevenueOrdersBetween(LocalDateTime start, LocalDateTime end) {
        Query query = Query.query(Criteria.where("status").nin(revenueExcludedStates())
                        .and("createdAt").gte(start).lt(end))
                .with(Sort.by(Sort.Direction.DESC, "createdAt"));
        return mongoTemplate.find(query, Order.class);
    }

    @Override
    public Double sumRevenueBetween(LocalDateTime start, LocalDateTime end) {
        return sumGrandTotal(Query.query(Criteria.where("status").nin(revenueExcludedStates())
                .and("createdAt").gte(start).lte(end)));
    }

    @Override
    public Double sumRevenue(LocalDateTime start, LocalDateTime end) {
        return sumGrandTotal(Query.query(Criteria.where("status").is(OrderStatus.CANCELLED).not()
                .and("createdAt").gte(start).lte(end)));
    }

    @Override
    public Double sumDeliveredRevenue() {
        return sumGrandTotal(Query.query(Criteria.where("status").is(OrderStatus.DELIVERED)));
    }

    /**
     * Sums {@code grandTotal} over the matching orders in the database. An empty
     * match returns 0, mirroring the {@code COALESCE(SUM(...), 0)} the SQL used
     * (the dashboard adds these numbers up, so null would propagate).
     */
    private Double sumGrandTotal(Query query) {
        AggregationOperation match = context -> new Document("$match", query.getQueryObject());
        AggregationOperation group = context -> new Document("$group",
                new Document("_id", null).append("revenue",
                        new Document("$sum", "$grandTotal")));
        List<Document> results = mongoTemplate
                .aggregate(Aggregation.newAggregation(match, group), Order.class, Document.class)
                .getMappedResults();
        if (results.isEmpty()) {
            return 0.0;
        }
        return toBigDecimal(results.get(0).get("revenue")).doubleValue();
    }

    @Override
    public List<Object[]> countByStatusBetween(LocalDateTime start, LocalDateTime end) {
        Aggregation aggregation = Aggregation.newAggregation(
                Aggregation.match(Criteria.where("createdAt").gte(start).lt(end)),
                Aggregation.group("status").count().as("count"));
        return mongoTemplate.aggregate(aggregation, Order.class, Document.class)
                .getMappedResults().stream()
                // Enums are stored as their name(), so turn the group key back
                // into the enum — that is the shape the old JPQL returned.
                .map(doc -> new Object[]{toOrderStatus(doc.get("_id")), toLong(doc.get("count"))})
                .toList();
    }

    @Override
    public List<Object[]> revenueByMonthBetween(LocalDateTime start, LocalDateTime end) {
        Aggregation aggregation = Aggregation.newAggregation(
                Aggregation.match(revenueWindow(start, end)),
                Aggregation.project()
                        .and("grandTotal").as("grandTotal")
                        .andExpression(datePartExpression("$year", REPORT_ZONE)).as("year")
                        .andExpression(datePartExpression("$month", REPORT_ZONE)).as("month"),
                Aggregation.group("year", "month")
                        .sum("grandTotal").as("revenue")
                        .count().as("count"));        return mongoTemplate.aggregate(aggregation, Order.class, Document.class)
                .getMappedResults().stream()
                .map(doc -> {
                    Document id = doc.get("_id", Document.class);
                    Object year = id == null ? null : id.get("year");
                    Object month = id == null ? null : id.get("month");
                    return new Object[]{toInt(year), toInt(month),
                            toBigDecimal(doc.get("revenue")), toLong(doc.get("count"))};
                })
                .toList();
    }

    @Override
    public List<Object[]> revenueByDayBetween(LocalDateTime start, LocalDateTime end) {
        Aggregation aggregation = Aggregation.newAggregation(
                Aggregation.match(revenueWindow(start, end)),
                Aggregation.project()
                        .and("grandTotal").as("grandTotal")
                        .andExpression(dateToStringExpression("%Y-%m-%dT00:00:00", REPORT_ZONE)).as("day"),
                Aggregation.group("day")
                        .sum("grandTotal").as("revenue")
                        .count().as("count"));
        return mongoTemplate.aggregate(aggregation, Order.class, Document.class)
                .getMappedResults().stream()
                .map(doc -> new Object[]{LocalDate.parse((String) doc.get("_id")),
                        toBigDecimal(doc.get("revenue")), toLong(doc.get("count"))})
                .toList();
    }

    @Override
    public List<Order> searchDeliveryBoard(Collection<OrderStatus> statuses, String keyword,
                                          Long deliveryBoyId, LocalDateTime from, LocalDateTime to) {
        if (statuses == null || statuses.isEmpty()) {
            // Matches the old JPQL, which could never receive an empty IN ().
            return new ArrayList<>();
        }
        List<Criteria> filters = new ArrayList<>();
        filters.add(Criteria.where("status").in(statuses));
        if (keyword != null && !keyword.isBlank()) {
            Pattern contains = Pattern.compile(Pattern.quote(keyword), Pattern.CASE_INSENSITIVE);
            filters.add(new Criteria().orOperator(
                    Criteria.where("orderNumber").regex(contains),
                    Criteria.where("customerName").regex(contains),
                    Criteria.where("customerPhone").regex(contains)));
        }
        if (from != null || to != null) {
            Criteria created = Criteria.where("createdAt");
            if (from != null) {
                created = created.gte(from);
            }
            if (to != null) {
                created = created.lt(to);
            }
            filters.add(created);
        }

        List<Order> orders = mongoTemplate.find(
                Query.query(new Criteria().andOperator(filters.toArray(new Criteria[0])))
                        .with(Sort.by(Sort.Direction.DESC, "createdAt")),
                Order.class);

        if (deliveryBoyId == null) {
            return orders;
        }
        List<Long> assignedToBoy = orderIdsCurrentlyHeldBy(deliveryBoyId);
        return orders.stream()
                .filter(order -> assignedToBoy.contains(order.getId()))
                .toList();
    }

    /**
     * Ids of the orders whose newest open assignment belongs to this delivery
     * boy. Scoping to the boy (and not merely to "the order has an open
     * assignment") is what keeps a reassigned order out of the previous boy's
     * board.
     */
    private List<Long> orderIdsCurrentlyHeldBy(Long deliveryBoyId) {
        List<DeliveryAssignment> assignments = mongoTemplate.find(
                Query.query(Criteria.where("deliveryBoyId").is(deliveryBoyId)
                                .and("status").in(openAssignmentStates()))
                        .with(Sort.by(Sort.Direction.ASC, "assignedAt")),
                DeliveryAssignment.class);
        List<Long> orderIds = new ArrayList<>();
        for (DeliveryAssignment assignment : assignments) {
            // Ascending order means the last write for an order wins.
            orderIds.remove(assignment.getOrderId());
            orderIds.add(assignment.getOrderId());
        }
        return orderIds;
    }

    // ------------------------------------------------------------------
    // Embedded order-item reporting
    // ------------------------------------------------------------------

    @Override
    public List<Object[]> findTopSellingProducts() {
        Aggregation aggregation = Aggregation.newAggregation(
                Aggregation.unwind("items"),
                Aggregation.group("items.productId", "items.productName")
                        .sum("items.quantity").as("quantity")
                        .sum("items.subtotal").as("subtotal"),
                Aggregation.sort(Sort.Direction.DESC, "quantity"));
        return mongoTemplate.aggregate(aggregation, Order.class, Document.class)
                .getMappedResults().stream()
                .map(doc -> {
                    Document id = doc.get("_id", Document.class);
                    return new Object[]{id == null ? null : toLong(id.get("productId")),
                            id == null ? null : id.get("productName"),
                            toLong(doc.get("quantity")), toBigDecimal(doc.get("subtotal"))};
                })
                .toList();
    }

    @Override
    public List<Object[]> findTopSellingProductsBetween(LocalDateTime start, LocalDateTime end) {
        Aggregation aggregation = Aggregation.newAggregation(
                Aggregation.match(itemWindow(start, end)),
                Aggregation.unwind("items"),
                Aggregation.group("items.productId", "items.productName")
                        .sum("items.quantity").as("quantity")
                        .sum("items.subtotal").as("subtotal"),
                Aggregation.sort(Sort.Direction.DESC, "quantity"));
        return mongoTemplate.aggregate(aggregation, Order.class, Document.class)
                .getMappedResults().stream()
                .map(doc -> {
                    Document id = doc.get("_id", Document.class);
                    return new Object[]{id == null ? null : toLong(id.get("productId")),
                            id == null ? null : id.get("productName"),
                            toLong(doc.get("quantity")), toBigDecimal(doc.get("subtotal"))};
                })
                .toList();
    }

    @Override
    public List<Object[]> findCategoryWiseSales() {
        return categoryWiseSales(null, null);
    }

    @Override
    public List<Object[]> findCategoryWiseSalesBetween(LocalDateTime start, LocalDateTime end) {
        return categoryWiseSales(start, end);
    }

    /**
     * Grunts out {@code [productId, quantity, subtotal]} per product — the
     * category a product belongs to is a separate collection, so the caller
     * resolves ids to names. This mirrors the old JPQL, which reached the
     * category through a join.
     */
    private List<Object[]> categoryWiseSales(LocalDateTime start, LocalDateTime end) {
        List<AggregationOperation> operations = new ArrayList<>();
        if (start != null) {
            operations.add(Aggregation.match(itemWindow(start, end)));
        }
        operations.add(Aggregation.unwind("items"));
        operations.add(Aggregation.group("items.productId")
                .sum("items.quantity").as("quantity")
                .sum("items.subtotal").as("subtotal"));
        return mongoTemplate
                .aggregate(Aggregation.newAggregation(operations), Order.class, Document.class)
                .getMappedResults().stream()
                .map(doc -> new Object[]{toLong(doc.get("_id")),
                        toLong(doc.get("quantity")), toBigDecimal(doc.get("subtotal"))})
                .toList();
    }

    @Override
    public List<Object[]> findContributingOrderItemsBetween(LocalDateTime start, LocalDateTime end) {
        Aggregation aggregation = Aggregation.newAggregation(
                Aggregation.match(contributingWindow(start, end)),
                Aggregation.sort(Sort.Direction.ASC, "id"),
                Aggregation.unwind("items"),
                Aggregation.sort(Sort.Direction.ASC, "items.id"),
                Aggregation.project()
                        .and("orderNumber").as("orderNumber")
                        .and("items.productName").as("productName")
                        .and("items.quantity").as("quantity"));
        return mongoTemplate.aggregate(aggregation, Order.class, Document.class)
                .getMappedResults().stream()
                .map(doc -> new Object[]{doc.getString("orderNumber"),
                        doc.getString("productName"), toInt(doc.get("quantity"))})
                .toList();
    }

    @Override
    public long sumQuantitySoldBetween(LocalDateTime start, LocalDateTime end) {
        Aggregation aggregation = Aggregation.newAggregation(
                Aggregation.match(itemWindow(start, end)),
                Aggregation.unwind("items"),
                Aggregation.group().sum("items.quantity").as("quantity"));
        List<Document> results = mongoTemplate
                .aggregate(aggregation, Order.class, Document.class).getMappedResults();
        if (results.isEmpty()) {
            return 0L;
        }
        Long quantity = toLong(results.get(0).get("quantity"));
        return quantity == null ? 0L : quantity;
    }

    @Override
    public List<Order> findOrdersForProductBetween(Long productId, LocalDateTime start, LocalDateTime end) {
        Query query = Query.query(Criteria.where("status").nin(revenueExcludedStates())
                        .and("items.productId").is(productId)
                        .and("createdAt").gte(start).lt(end))
                .with(Sort.by(Sort.Direction.DESC, "createdAt"));
        return mongoTemplate.find(query, Order.class);
    }

    /** Window shared by the item reports: {@code CANCELLED} orders are skipped. */
    private Criteria itemWindow(LocalDateTime start, LocalDateTime end) {
        return Criteria.where("status").ne(OrderStatus.CANCELLED)
                .and("createdAt").gte(start).lt(end);
    }

    /** Window shared with {@link #sumQuantitySoldBetween}: drops placed but unconfirmed orders too. */
    private Criteria contributingWindow(LocalDateTime start, LocalDateTime end) {
        return Criteria.where("status").nin(revenueExcludedStates())
                .and("createdAt").gte(start).lt(end);
    }

    private Criteria revenueWindow(LocalDateTime start, LocalDateTime end) {
        return Criteria.where("status").nin(revenueExcludedStates())
                .and("createdAt").gte(start).lt(end);
    }

    private List<OrderStatus> revenueExcludedStates() {
        return List.of(OrderStatus.PLACED, OrderStatus.CANCELLED);
    }

    private List<DeliveryAssignmentStatus> openAssignmentStates() {
        return List.of(DeliveryAssignmentStatus.ASSIGNED,
                DeliveryAssignmentStatus.STARTED,
                DeliveryAssignmentStatus.COMPLETED);
    }

    /**
     * The {@code $year}/{@code $month} expression, as the JSON string
     * {@code ProjectionOperation.andExpression} expects. Passed a zone because
     * stored {@code LocalDateTime}s are written in the system default zone.
     */
    private String datePartExpression(String operator, ZoneId zone) {
        return new Document("$" + operator,
                new Document("date", "$createdAt").append("timezone", zone.getId())).toJson();
    }

    /** The {@code $dateToString} expression, as the JSON string a projection expects. */
    private String dateToStringExpression(String format, ZoneId zone) {
        return new Document("$dateToString",
                new Document("date", "$createdAt")
                        .append("format", format)
                        .append("timezone", zone.getId())).toJson();
    }

    private static Long toLong(Object value) {
        return value instanceof Number number ? number.longValue() : null;
    }

    /** Group key back to the enum; null for a missing/unknown value. */
    private static OrderStatus toOrderStatus(Object value) {
        if (value instanceof OrderStatus status) {
            return status;
        }
        if (value == null) {
            return null;
        }
        try {
            return OrderStatus.valueOf(value.toString());
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }

    private static Integer toInt(Object value) {
        return value instanceof Number number ? number.intValue() : null;
    }

    private static BigDecimal toBigDecimal(Object value) {
        if (value == null) {
            return BigDecimal.ZERO;
        }
        if (value instanceof BigDecimal decimal) {
            return decimal;
        }
        if (value instanceof org.bson.types.Decimal128 decimal128) {
            return decimal128.bigDecimalValue();
        }
        return value instanceof Number number
                ? BigDecimal.valueOf(number.doubleValue())
                : BigDecimal.ZERO;
    }
}
