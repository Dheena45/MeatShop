package com.freshmeat.service;

import com.freshmeat.dto.AdminDashboardDTO;
import com.freshmeat.entity.Order;
import com.freshmeat.enums.Role;
import com.freshmeat.enums.OrderStatus;
import com.freshmeat.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.util.*;

@Service
public class AdminService {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private ProductRepository productRepository;

    @Autowired
    private OrderRepository orderRepository;

    @Autowired
    private OrderItemRepository orderItemRepository;

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
        List<Object[]> rows = orderItemRepository.findTopSellingProducts();
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
        List<Object[]> rows = orderItemRepository.findCategoryWiseSales();
        for (Object[] row : rows) {
            Map<String, Object> entry = new LinkedHashMap<>();
            entry.put("category", row[0] == null ? "Uncategorized" : row[0]);
            entry.put("sales", row[1]);
            result.add(entry);
        }
        return result;
    }
}
