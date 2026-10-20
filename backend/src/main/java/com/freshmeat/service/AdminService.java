package com.freshmeat.service;

import com.freshmeat.dto.*;
import com.freshmeat.entity.Order;
import com.freshmeat.entity.OrderItem;
import com.freshmeat.entity.Product;
import com.freshmeat.entity.Inventory;
import com.freshmeat.enums.Role;
import com.freshmeat.enums.OrderStatus;
import com.freshmeat.exception.BadRequestException;
import com.freshmeat.exception.ResourceNotFoundException;
import com.freshmeat.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class AdminService {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private ProductRepository productRepository;

    @Autowired
    private OrderRepository orderRepository;

    @Autowired
    private CategoryRepository categoryRepository;

    @Autowired
    private InventoryRepository inventoryRepository;

    public AdminDashboardDTO getDashboardData() {
        AdminDashboardDTO dto = new AdminDashboardDTO();

        dto.setTotalCustomers(userRepository.findByRole(Role.CUSTOMER).size());
        dto.setTotalProducts(productRepository.count());
        dto.setTotalOrders(orderRepository.count());

        LocalDateTime startOfToday = LocalDate.now().atStartOfDay();
        LocalDateTime startOfTomorrow = startOfToday.plusDays(1);
        dto.setTodaysOrders(orderRepository.countByCreatedAtBetween(startOfToday, startOfTomorrow));

        Double todayRevenue = orderRepository.sumRevenueBetween(startOfToday, startOfTomorrow);
        dto.setTodaysRevenue(todayRevenue == null ? 0 : todayRevenue);

        LocalDateTime monthStart = YearMonth.now().atDay(1).atStartOfDay();
        LocalDateTime nextMonthStart = YearMonth.now().plusMonths(1).atDay(1).atStartOfDay();
        Double monthlyRevenue = orderRepository.sumRevenueBetween(monthStart, nextMonthStart);
        dto.setMonthlyRevenue(monthlyRevenue == null ? 0 : monthlyRevenue);

        dto.setLowStockProducts(productRepository.findLowStockProducts().size()
                + productRepository.findOutOfStockProducts().size());

        dto.setMonthlySales(getMonthlySales());
        dto.setOrderStatusDistribution(getOrderStatusDistribution());
        dto.setTopSellingProducts(getTopSellingProducts());
        dto.setCategoryWiseSales(getCategoryWiseSales());

        return dto;
    }

    private List<Map<String, Object>> getMonthlySales() {
        List<Map<String, Object>> result = new ArrayList<>();
        YearMonth current = YearMonth.now();
        for (int i = 5; i >= 0; i--) {
            YearMonth month = current.minusMonths(i);
            LocalDateTime start = month.atDay(1).atStartOfDay();
            LocalDateTime end = month.plusMonths(1).atDay(1).atStartOfDay();
            Double revenue = orderRepository.sumRevenueBetween(start, end);
            Map<String, Object> entry = new LinkedHashMap<>();
            entry.put("month", month.getMonth().toString().substring(0, 3) + " " + month.getYear() % 100);
            entry.put("revenue", revenue == null ? 0.0 : revenue);
            result.add(entry);
        }
        return result;
    }

    private List<Map<String, Object>> getOrderStatusDistribution() {
        List<Map<String, Object>> result = new ArrayList<>();
        for (OrderStatus status : OrderStatus.values()) {
            long count = orderRepository.findByStatus(status).size();
            if (count > 0) {
                Map<String, Object> entry = new LinkedHashMap<>();
                entry.put("status", status.name().replace("_", " "));
                entry.put("count", count);
                result.add(entry);
            }
        }
        return result;
    }

    private List<Map<String, Object>> getTopSellingProducts() {
        List<Map<String, Object>> result = new ArrayList<>();
        List<Object[]> rows = orderRepository.findTopSellingProducts();
        for (int i = 0; i < Math.min(5, rows.size()); i++) {
            Object[] row = rows.get(i);
            Map<String, Object> entry = new LinkedHashMap<>();
            entry.put("name", row[1]);
            entry.put("quantity", row[2]);
            result.add(entry);
        }
        return result;
    }

    private List<Map<String, Object>> getCategoryWiseSales() {
        List<Map<String, Object>> result = new ArrayList<>();
        Map<Long, String> names = categoryNames();
        Map<Long, double[]> byCategory = new LinkedHashMap<>();
        for (Object[] row : orderRepository.findCategoryWiseSales()) {
            Long categoryId = (Long) row[0];
            double[] v = byCategory.computeIfAbsent(categoryId, k -> new double[]{0, 0});
            v[0] += row[1] == null ? 0 : ((Number) row[1]).doubleValue();
            v[1] += num(row[2]);
        }
        for (Map.Entry<Long, double[]> e : byCategory.entrySet()) {
            Map<String, Object> entry = new LinkedHashMap<>();
            entry.put("category", e.getKey() == null ? "Uncategorized"
                    : names.getOrDefault(e.getKey(), "Uncategorized"));
            entry.put("sales", e.getValue()[1]);
            result.add(entry);
        }
        return result;
    }

    /** category id -> name, for the sales groupings that only know the id. */
    private Map<Long, String> categoryNames() {
        Map<Long, String> names = new HashMap<>();
        categoryRepository.findAll().forEach(c -> names.put(c.getId(), c.getName()));
        return names;
    }

    public DashboardSummaryDTO getSummary(LocalDate from, LocalDate to) {
        DateRange range = resolveRange(from, to);
        Double revenue = orderRepository.sumRevenueBetween(range.start, range.end);

        DashboardSummaryDTO dto = new DashboardSummaryDTO();
        dto.setRevenue(revenue == null ? 0 : revenue);
        dto.setTotalOrders(orderRepository.countByCreatedAtBetween(range.start, range.end));

        CustomerSummaryDTO customers = getCustomerSummary(from, to);
        dto.setCustomers(customers.getTotal());
        dto.setActiveCustomers(customers.getActive());
        dto.setInactiveCustomers(customers.getInactive());
        dto.setNewCustomers(customers.getNewThisMonth());

        InventorySummaryDTO inventory = getInventorySummary();
        dto.setTotalProducts(inventory.getTotalProducts());
        dto.setInStock(inventory.getInStock());
        dto.setLowStock(inventory.getLowStock());
        dto.setOutOfStock(inventory.getOutOfStock());
        return dto;
    }

    public List<RevenueTrendPointDTO> getRevenueTrend(LocalDate from, LocalDate to) {
        DateRange range = resolveRange(from, to);
        long days = ChronoUnit.DAYS.between(range.start.toLocalDate(), range.end.toLocalDate());
        boolean daily = days <= 32;

        List<RevenueTrendPointDTO> result = new ArrayList<>();
        if (daily) {
            Map<LocalDate, double[]> byKey = new HashMap<>();
            for (Object[] row : orderRepository.revenueByDayBetween(range.start, range.end)) {
                LocalDate day = (LocalDate) row[0];
                byKey.put(day, new double[]{num(row[1]), num(row[2])});
            }
            LocalDate start = range.start.toLocalDate();
            LocalDate end = range.end.toLocalDate();
            DateTimeFormatter fmt = DateTimeFormatter.ofPattern("d MMM yyyy");
            DateTimeFormatter shortFmt = DateTimeFormatter.ofPattern("d MMM");
            for (LocalDate d = start; !d.isAfter(end); d = d.plusDays(1)) {
                double[] v = byKey.getOrDefault(d, new double[]{0, 0});
                result.add(point(d.format(fmt), d.format(shortFmt), v));
            }
        } else {
            Map<YearMonth, double[]> byKey = new HashMap<>();
            for (Object[] row : orderRepository.revenueByMonthBetween(range.start, range.end)) {
                YearMonth ym = YearMonth.of(((Number) row[0]).intValue(), ((Number) row[1]).intValue());
                byKey.put(ym, new double[]{num(row[2]), num(row[3])});
            }
            YearMonth start = YearMonth.from(range.start);
            YearMonth end = YearMonth.from(range.end);
            for (YearMonth ym = start; !ym.isAfter(end); ym = ym.plusMonths(1)) {
                String monthName = ym.getMonth().name().charAt(0)
                        + ym.getMonth().name().substring(1).toLowerCase();
                String label = monthName + " " + ym.getYear();
                String shortLabel = ym.getMonth().toString().substring(0, 3) + " '" + (ym.getYear() % 100);
                double[] v = byKey.getOrDefault(ym, new double[]{0, 0});
                result.add(point(label, shortLabel, v));
            }
        }
        return result;
    }

    public List<OrderStatusCountDTO> getOrderStatus(LocalDate from, LocalDate to) {
        DateRange range = resolveRange(from, to);
        Map<OrderStatus, Long> counts = new EnumMap<>(OrderStatus.class);
        for (OrderStatus s : OrderStatus.values()) {
            counts.put(s, 0L);
        }
        for (Object[] row : orderRepository.countByStatusBetween(range.start, range.end)) {
            if (row[0] != null) {
                counts.put((OrderStatus) row[0], ((Number) row[1]).longValue());
            }
        }
        List<OrderStatusCountDTO> result = new ArrayList<>();
        for (OrderStatus s : OrderStatus.values()) {
            OrderStatusCountDTO dto = new OrderStatusCountDTO();
            dto.setStatus(s.name());
            dto.setCount(counts.get(s));
            result.add(dto);
        }
        return result;
    }

    public List<TopProductDTO> getTopProducts(LocalDate from, LocalDate to) {
        DateRange range = resolveRange(from, to);
        List<Object[]> rows = orderRepository.findTopSellingProductsBetween(range.start, range.end);
        List<TopProductDTO> result = new ArrayList<>();
        for (int i = 0; i < Math.min(5, rows.size()); i++) {
            Object[] row = rows.get(i);
            TopProductDTO dto = new TopProductDTO();
            dto.setProductId(((Number) row[0]).longValue());
            dto.setProductName((String) row[1]);
            dto.setSoldQuantity(((Number) row[2]).longValue());
            dto.setRevenue(num(row[3]));
            result.add(dto);
        }
        return result;
    }

    public List<CategorySalesDTO> getCategorySales(LocalDate from, LocalDate to) {
        DateRange range = resolveRange(from, to);
        Map<Long, String> names = categoryNames();
        Map<Long, long[]> quantities = new LinkedHashMap<>();
        Map<Long, Double> revenues = new LinkedHashMap<>();
        double total = 0;
        for (Object[] row : orderRepository.findCategoryWiseSalesBetween(range.start, range.end)) {
            Long categoryId = (Long) row[0];
            long qty = row[1] == null ? 0 : ((Number) row[1]).longValue();
            double revenue = num(row[2]);
            quantities.computeIfAbsent(categoryId, k -> new long[1])[0] += qty;
            revenues.merge(categoryId, revenue, Double::sum);
            total += revenue;
        }
        List<CategorySalesDTO> result = new ArrayList<>();
        for (Long categoryId : quantities.keySet()) {
            long qty = quantities.get(categoryId)[0];
            double revenue = revenues.getOrDefault(categoryId, 0.0);
            CategorySalesDTO dto = new CategorySalesDTO();
            dto.setCategory(categoryId == null ? "Other"
                    : names.getOrDefault(categoryId, "Other"));
            dto.setQuantity(qty);
            dto.setRevenue(revenue);
            dto.setPercentage(total == 0 ? 0 : Math.round(revenue / total * 1000.0) / 10.0);
            result.add(dto);
        }
        return result;
    }

    public InventorySummaryDTO getInventorySummary() {
        InventorySummaryDTO dto = new InventorySummaryDTO();
        long total = productRepository.count();
        List<Product> out = getOutOfStockProducts();
        List<Product> low = getLowStockProducts();

        dto.setTotalProducts(total);
        dto.setLowStock(low.size());
        dto.setOutOfStock(out.size());
        dto.setInStock(Math.max(0, total - low.size() - out.size()));
        dto.setLowStockItems(low.stream().map(this::toInventoryItem).collect(Collectors.toList()));
        dto.setOutOfStockItems(out.stream().map(this::toInventoryItem).collect(Collectors.toList()));
        return dto;
    }

    private List<Product> getLowStockProducts() {
        return inventoryRepository.findLowStockInventory().stream()
                .filter(i -> i.getProduct() != null)
                .map(Inventory::getProduct)
                .collect(Collectors.toList());
    }

    private List<Product> getOutOfStockProducts() {
        return inventoryRepository.findOutOfStockInventory().stream()
                .filter(i -> i.getProduct() != null)
                .map(Inventory::getProduct)
                .collect(Collectors.toList());
    }

    public CustomerSummaryDTO getCustomerSummary(LocalDate from, LocalDate to) {
        DateRange range = resolveRange(from, to);
        CustomerSummaryDTO dto = new CustomerSummaryDTO();
        dto.setTotal(userRepository.countByRole(Role.CUSTOMER));
        dto.setActive(userRepository.countByRoleAndEnabled(Role.CUSTOMER, true));
        dto.setInactive(userRepository.countByRoleAndEnabled(Role.CUSTOMER, false));
        dto.setNewThisMonth(userRepository.countNewCustomersBetween(range.start, range.end));
        return dto;
    }

    public List<DashboardOrderRowDTO> getOrders(LocalDate from, LocalDate to) {
        DateRange range = resolveRange(from, to);
        Map<String, List<MonthlyOrderItemDTO>> itemsByOrder = new HashMap<>();
        for (Object[] row : orderRepository.findContributingOrderItemsBetween(range.start, range.end)) {
            MonthlyOrderItemDTO item = new MonthlyOrderItemDTO();
            item.setProductName((String) row[1]);
            item.setQuantity(((Number) row[2]).intValue());
            itemsByOrder.computeIfAbsent((String) row[0], k -> new ArrayList<>()).add(item);
        }
        return orderRepository.findAllOrdersBetween(range.start, range.end).stream()
                .map(o -> {
                    DashboardOrderRowDTO dto = new DashboardOrderRowDTO();
                    dto.setOrderNumber(o.getOrderNumber());
                    dto.setCustomerName(o.getCustomerName());
                    dto.setCreatedAt(o.getCreatedAt());
                    dto.setGrandTotal(o.getGrandTotal());
                    dto.setStatus(o.getStatus() == null ? "" : o.getStatus().name());
                    dto.setItems(OrderStatus.CANCELLED.equals(o.getStatus())
                            ? Collections.emptyList()
                            : itemsByOrder.getOrDefault(o.getOrderNumber(), Collections.emptyList()));
                    return dto;
                }).collect(Collectors.toList());
    }

    public long getTotalItemsSold(LocalDate from, LocalDate to) {
        DateRange range = resolveRange(from, to);
        return orderRepository.sumQuantitySoldBetween(range.start, range.end);
    }

    public YearlySummaryDTO getYearlySummary(LocalDate from, LocalDate to) {
        DateRange range = resolveRange(from, to);

        YearlySummaryDTO dto = new YearlySummaryDTO();

        Double sales = orderRepository.sumRevenueBetween(range.start, range.end);
        dto.setTotalSales(sales == null ? 0 : sales);
        long totalOrders = orderRepository.countByCreatedAtBetween(range.start, range.end);
        dto.setTotalOrders(totalOrders);
        dto.setTotalItemsSold(orderRepository.sumQuantitySoldBetween(range.start, range.end));

        Map<OrderStatus, Long> statusCounts = new EnumMap<>(OrderStatus.class);
        for (OrderStatus s : OrderStatus.values()) {
            statusCounts.put(s, 0L);
        }
        for (Object[] row : orderRepository.countByStatusBetween(range.start, range.end)) {
            if (row[0] != null) {
                statusCounts.put((OrderStatus) row[0], ((Number) row[1]).longValue());
            }
        }
        long cancelled = statusCounts.getOrDefault(OrderStatus.CANCELLED, 0L);
        // READY_FOR_PICKUP is the stage between PREPARING and OUT_FOR_DELIVERY, so
        // it is counted with the orders going out rather than being dropped from
        // the summary entirely.
        long readyForPickup = statusCounts.getOrDefault(OrderStatus.READY_FOR_PICKUP, 0L);
        dto.setConfirmedOrders(statusCounts.getOrDefault(OrderStatus.CONFIRMED, 0L));
        dto.setPreparingOrders(statusCounts.getOrDefault(OrderStatus.PREPARING, 0L));
        dto.setOutForDeliveryOrders(statusCounts.getOrDefault(OrderStatus.OUT_FOR_DELIVERY, 0L)
                + readyForPickup);
        dto.setDeliveredOrders(statusCounts.getOrDefault(OrderStatus.DELIVERED, 0L));
        dto.setCancelledOrders(cancelled);

        long validOrders = Math.max(0, totalOrders - cancelled);
        dto.setAverageOrderValue(validOrders > 0 ? dto.getTotalSales() / validOrders : 0);

        dto.setTotalCustomers(userRepository.countByRole(Role.CUSTOMER));
        dto.setNewCustomers(userRepository.countNewCustomersBetween(range.start, range.end));
        dto.setActiveCustomers(userRepository.countByRoleAndEnabled(Role.CUSTOMER, true));
        dto.setInactiveCustomers(userRepository.countByRoleAndEnabled(Role.CUSTOMER, false));

        dto.setTotalProducts(productRepository.count());
        dto.setActiveProducts(productRepository.countByAvailable(true));
        dto.setInactiveProducts(productRepository.countByAvailable(false));
        dto.setLowStockProducts(getLowStockProducts().size());
        dto.setOutOfStockProducts(getOutOfStockProducts().size());

        List<Object[]> topProducts = orderRepository.findTopSellingProductsBetween(range.start, range.end);
        if (!topProducts.isEmpty()) {
            dto.setBestSellingProduct((String) topProducts.get(0)[1]);
        }

        String topCategory = null;
        long topQty = 0;
        Map<Long, String> categoryNames = categoryNames();
        Map<Long, Long> quantityByCategory = new LinkedHashMap<>();
        for (Object[] row : orderRepository.findCategoryWiseSalesBetween(range.start, range.end)) {
            long qty = row[1] == null ? 0 : ((Number) row[1]).longValue();
            quantityByCategory.merge((Long) row[0], qty, Long::sum);
        }
        for (Map.Entry<Long, Long> e : quantityByCategory.entrySet()) {
            if (e.getValue() > topQty) {
                topQty = e.getValue();
                topCategory = e.getKey() == null ? "Uncategorized"
                        : categoryNames.getOrDefault(e.getKey(), "Uncategorized");
            }
        }
        if (topQty > 0) {
            dto.setTopCategory(topCategory);
        }

        double highest = 0;
        for (Order o : orderRepository.findRevenueOrdersBetween(range.start, range.end)) {
            double gt = o.getGrandTotal() == null ? 0 : o.getGrandTotal().doubleValue();
            if (gt > highest) {
                highest = gt;
            }
        }
        dto.setHighestOrderValue(highest);

        return dto;
    }

    public ProductSalesDTO getProductSales(Long productId, LocalDate from, LocalDate to) {
        DateRange range = resolveRange(from, to);
        Product product = productRepository.findById(productId)
                .orElseThrow(() -> new ResourceNotFoundException("Product not found"));

        // Orders are already newest first; each order holds its own line items,
        // so no second lookup is needed to reach them.
        List<Order> orders = orderRepository.findOrdersForProductBetween(productId, range.start, range.end);

        long totalQuantity = 0;
        BigDecimal totalAmount = BigDecimal.ZERO;
        LocalDateTime lastSold = null;
        List<ProductSalesOrderDTO> recentOrders = new ArrayList<>();
        for (Order o : orders) {
            long quantity = 0;
            BigDecimal amount = BigDecimal.ZERO;
            for (OrderItem oi : o.getItems()) {
                if (!productId.equals(oi.getProductId())) {
                    continue;
                }
                quantity += oi.getQuantity() == null ? 0 : oi.getQuantity();
                amount = amount.add(oi.getSubtotal() == null ? BigDecimal.ZERO : oi.getSubtotal());
            }
            if (quantity == 0) {
                continue;
            }
            if (lastSold == null || (o.getCreatedAt() != null && o.getCreatedAt().isAfter(lastSold))) {
                lastSold = o.getCreatedAt();
            }
            totalQuantity += quantity;
            totalAmount = totalAmount.add(amount);

            ProductSalesOrderDTO row = new ProductSalesOrderDTO();
            row.setOrderNumber(o.getOrderNumber());
            row.setQuantity(quantity);
            row.setAmount(amount);
            row.setOrderDate(o.getCreatedAt());
            row.setStatus(o.getStatus() == null ? "" : o.getStatus().name());
            recentOrders.add(row);
        }

        double average = totalQuantity > 0
                ? totalAmount.divide(BigDecimal.valueOf(totalQuantity), 2, java.math.RoundingMode.HALF_UP).doubleValue()
                : 0;

        ProductSalesDTO dto = new ProductSalesDTO();
        dto.setProductId(product.getId());
        dto.setProductName(product.getName());
        dto.setCategoryName(product.getCategory() == null ? null : product.getCategory().getName());
        dto.setLastSoldDate(lastSold == null ? null : lastSold.toLocalDate());
        dto.setTotalQuantitySold(totalQuantity);
        dto.setTotalOrders(recentOrders.size());
        dto.setTotalSalesAmount(totalAmount.doubleValue());
        dto.setAverageSellingPrice(average);
        dto.setCurrentStock(product.getStockQuantity() == null ? 0 : product.getStockQuantity());
        dto.setUnit(product.getUnit() == null ? "KG" : product.getUnit());
        dto.setDiscountPercent(product.getDiscountPercent() == null ? 0 : product.getDiscountPercent().doubleValue());
        dto.setAvailable(product.getAvailable() != null && product.getAvailable());
        dto.setRecentOrders(recentOrders);
        return dto;
    }

    private RevenueTrendPointDTO point(String label, String shortLabel, double[] v) {
        RevenueTrendPointDTO p = new RevenueTrendPointDTO();
        p.setLabel(label);
        p.setShortLabel(shortLabel);
        p.setRevenue(v[0]);
        p.setOrders((long) v[1]);
        return p;
    }

    private double num(Object o) {
        return o == null ? 0 : ((Number) o).doubleValue();
    }

    private InventoryItemDTO toInventoryItem(Product p) {
        InventoryItemDTO dto = new InventoryItemDTO();
        dto.setProductId(p.getId());
        dto.setProductName(p.getName());
        dto.setStockQuantity(p.getStockQuantity() == null ? 0 : p.getStockQuantity());
        return dto;
    }

    private DateRange resolveRange(LocalDate from, LocalDate to) {
        LocalDate start = from != null ? from : YearMonth.now().atDay(1);
        LocalDate end = to != null ? to : YearMonth.from(start).atEndOfMonth();
        if (start.isAfter(end)) {
            throw new BadRequestException("Invalid date range: start date must not be after end date");
        }
        DateRange range = new DateRange();
        range.start = start.atStartOfDay();
        range.end = end.plusDays(1).atStartOfDay();
        return range;
    }

    private static class DateRange {
        private LocalDateTime start;
        private LocalDateTime end;
    }
}
