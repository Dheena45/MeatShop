package com.freshmeat.repository;

import com.freshmeat.entity.DeliveryAssignment;
import com.freshmeat.entity.Order;
import com.freshmeat.enums.DeliveryAssignmentStatus;
import com.freshmeat.enums.OrderStatus;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;

import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * {@link DeliveryAssignmentRepositoryCustom} implemented with {@link MongoTemplate}.
 * <p>
 * The old JPQL joined the assignment to its order. Here the order search runs
 * first (one query, sorted), and the assignments are then fetched by order id
 * and put back in the order's sequence — the same rows in the same order, with
 * two queries instead of a join and no N+1.
 */
public class DeliveryAssignmentRepositoryCustomImpl implements DeliveryAssignmentRepositoryCustom {

    private final MongoTemplate mongoTemplate;

    public DeliveryAssignmentRepositoryCustomImpl(MongoTemplate mongoTemplate) {
        this.mongoTemplate = mongoTemplate;
    }

    @Override
    public List<DeliveryAssignment> searchForDeliveryBoy(Long deliveryBoyId,
                                                        Collection<OrderStatus> statuses,
                                                        String search) {
        if (statuses == null || statuses.isEmpty()) {
            return new ArrayList<>();
        }
        Criteria criteria = Criteria.where("status").in(statuses);
        if (search != null && !search.isBlank()) {
            Pattern contains = Pattern.compile(Pattern.quote(search), Pattern.CASE_INSENSITIVE);
            criteria = new Criteria().andOperator(criteria, new Criteria().orOperator(
                    Criteria.where("orderNumber").regex(contains),
                    Criteria.where("customerName").regex(contains),
                    Criteria.where("customerPhone").regex(contains)));
        }
        // Order's delivery slot first, then the order's own creation time.
        List<Order> orders = mongoTemplate.find(
                Query.query(criteria).with(Sort.by(
                        Sort.Order.asc("deliverySlot"),
                        Sort.Order.desc("createdAt"))),
                Order.class);
        return assignmentsInOrderOf(orders, deliveryBoyId, null);
    }

    @Override
    public List<DeliveryAssignment> findByDeliveryBoyIdAndOrderStatus(
            Long deliveryBoyId, OrderStatus status) {
        List<Order> orders = mongoTemplate.find(
                Query.query(Criteria.where("status").is(status))
                        .with(Sort.by(Sort.Direction.DESC, "createdAt")),
                Order.class);
        return assignmentsInOrderOf(orders, deliveryBoyId, null);
    }

    @Override
    public List<Long> findAssignedOrderIds(Collection<Long> orderIds,
                                           Collection<DeliveryAssignmentStatus> statuses) {
        if (orderIds == null || orderIds.isEmpty() || statuses == null || statuses.isEmpty()) {
            return new ArrayList<>();
        }
        Query query = Query.query(Criteria.where("orderId").in(orderIds).and("status").in(statuses));
        return mongoTemplate.findDistinct(query, "orderId", DeliveryAssignment.class, Long.class);
    }

    @Override
    public List<Long> findOrderIdsByDeliveryBoyIdAndStatusIn(
            Long deliveryBoyId, Collection<DeliveryAssignmentStatus> statuses) {
        if (deliveryBoyId == null || statuses == null || statuses.isEmpty()) {
            return new ArrayList<>();
        }
        Query query = Query.query(Criteria.where("deliveryBoyId").is(deliveryBoyId)
                .and("status").in(statuses));
        return mongoTemplate.findDistinct(query, "orderId", DeliveryAssignment.class, Long.class);
    }

    /**
     * Fetches the assignments of the supplied orders (optionally only one boy's)
     * and returns them following the order sequence, keeping every assignment row
     * — history included, exactly like the former join did.
     */
    private List<DeliveryAssignment> assignmentsInOrderOf(List<Order> orders,
                                                         Long deliveryBoyId,
                                                         Collection<DeliveryAssignmentStatus> statuses) {
        if (orders.isEmpty()) {
            return new ArrayList<>();
        }
        List<Long> orderIds = orders.stream().map(Order::getId).toList();
        Map<Long, Integer> position = new HashMap<>();
        for (int i = 0; i < orderIds.size(); i++) {
            position.putIfAbsent(orderIds.get(i), i);
        }

        Criteria criteria = Criteria.where("orderId").in(orderIds);
        if (deliveryBoyId != null) {
            criteria = criteria.and("deliveryBoyId").is(deliveryBoyId);
        }
        if (statuses != null && !statuses.isEmpty()) {
            criteria = criteria.and("status").in(statuses);
        }

        List<DeliveryAssignment> assignments = new ArrayList<>(
                mongoTemplate.find(Query.query(criteria), DeliveryAssignment.class));
        assignments.sort((a, b) -> Integer.compare(
                position.getOrDefault(a.getOrderId(), Integer.MAX_VALUE),
                position.getOrDefault(b.getOrderId(), Integer.MAX_VALUE)));
        return assignments;
    }
}
