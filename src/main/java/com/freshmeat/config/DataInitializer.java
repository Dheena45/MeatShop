package com.freshmeat.config;

import com.freshmeat.entity.*;
import com.freshmeat.enums.CuttingOption;
import com.freshmeat.enums.Role;
import com.freshmeat.repository.*;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.Arrays;
import java.util.List;

@Slf4j
@Component
public class DataInitializer implements CommandLineRunner {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private CategoryRepository categoryRepository;

    @Autowired
    private ProductRepository productRepository;

    @Autowired
    private InventoryRepository inventoryRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Override
    @Transactional
    public void run(String... args) {
        initAdmin();
        initCategories();
        initSampleProducts();
    }

    private void initAdmin() {
        if (!userRepository.existsByEmail("admin@freshmeat.com")) {
            User admin = new User();
            admin.setName("FreshMeat Admin");
            admin.setEmail("admin@freshmeat.com");
            admin.setPhone("9999999999");
            admin.setPassword(passwordEncoder.encode("admin123"));
            admin.setRole(Role.ADMIN);
            admin.setEnabled(true);
            userRepository.save(admin);
            log.info("Default admin created: admin@freshmeat.com / admin123");
        }
    }

    private void initCategories() {
        if (categoryRepository.count() > 0) return;

        createCategory("Chicken", "Fresh, tender and hygienically processed chicken");
        createCategory("Mutton", "Premium quality goat meat, farm fresh");
        createCategory("Beef", "High-quality beef cuts for your favorite recipes");
        createCategory("Fish", "Fresh catch, cleaned and ready to cook");
        createCategory("Country Chicken", "Naturally raised country chicken, rich in flavor");
        createCategory("Eggs", "Farm-fresh eggs for every meal");
        createCategory("Ready-to-Cook", "Marinated and prepped for quick cooking");
        createCategory("Special Cuts", "Premium special cuts and delicacies");
        log.info("Default categories created");
    }

    private void createCategory(String name, String description) {
        Category category = new Category();
        category.setName(name);
        category.setDescription(description);
        category.setActive(true);
        categoryRepository.save(category);
    }

    private void initSampleProducts() {
        if (productRepository.count() > 0) return;

        List<Category> categories = categoryRepository.findAll();
        Category chicken = findCategory(categories, "Chicken");
        Category mutton = findCategory(categories, "Mutton");
        Category beef = findCategory(categories, "Beef");
        Category fish = findCategory(categories, "Fish");
        Category countryChicken = findCategory(categories, "Country Chicken");
        Category eggs = findCategory(categories, "Eggs");
        Category readyToCook = findCategory(categories, "Ready-to-Cook");
        Category specialCuts = findCategory(categories, "Special Cuts");

        createProduct("Chicken Curry Cut", "Farm fresh chicken, curry cut pieces",
                "Whole chicken cut into curry-sized pieces, washed and ready to cook. Perfect for everyday curries.",
                new BigDecimal("180"), new BigDecimal("10"), 100, 1, chicken,
                Arrays.asList(CuttingOption.CURRY_CUT.name(), CuttingOption.SMALL_PIECES.name(),
                        CuttingOption.LARGE_PIECES.name(), CuttingOption.BONELESS.name(),
                        CuttingOption.BIRYANI_CUT.name()), true, true, "chicken-curry-cut.jpg");

        createProduct("Chicken Boneless Breast", "Premium boneless chicken breast",
                "Skinless boneless chicken breast, trimmed and cleaned. High protein, low fat. Ideal for grilling and stir-fries.",
                new BigDecimal("320"), new BigDecimal("15"), 60, 1, chicken,
                Arrays.asList(CuttingOption.BONELESS.name(), CuttingOption.SLICED.name(),
                        CuttingOption.LARGE_PIECES.name(), CuttingOption.BIRYANI_CUT.name()),
                true, true, "chicken-boneless-breast.jpg");

        createProduct("Mutton Curry Cut", "Fresh mutton curry pieces",
                "Premium goat meat cut into medium curry pieces. Cooked to perfection in traditional Indian style.",
                new BigDecimal("650"), new BigDecimal("8"), 40, 1, mutton,
                Arrays.asList(CuttingOption.CURRY_CUT.name(), CuttingOption.SMALL_PIECES.name(),
                        CuttingOption.LARGE_PIECES.name(), CuttingOption.CHOPS.name(),
                        CuttingOption.BIRYANI_CUT.name()), true, true, "mutton-curry-cut.jpg");

        createProduct("Mutton Biryani Cut", "Specially diced for biryani",
                "Tender mutton cut into small biryani-style pieces with bone. Perfect for authentic Hyderabadi biryani.",
                new BigDecimal("720"), new BigDecimal("12"), 30, 1, mutton,
                Arrays.asList(CuttingOption.BIRYANI_CUT.name(), CuttingOption.SMALL_PIECES.name(),
                        CuttingOption.CURRY_CUT.name()), true, true, "mutton-biryani-cut.jpg");

        createProduct("Mutton Keema", "Finely minced mutton",
                "Freshly minced mutton (keema), perfect for keema curry, kofta and kebabs. Premium lean meat.",
                new BigDecimal("700"), new BigDecimal("5"), 25, 1, mutton,
                Arrays.asList(CuttingOption.KEEMA.name()), true, true, "mutton-keema.jpg");

        createProduct("Beef Steak Cut", "Premium beef steak slices",
                "Angus-style beef steak cuts, tender and juicy. Ideal for grilling and pan-searing.",
                new BigDecimal("580"), new BigDecimal("10"), 35, 1, beef,
                Arrays.asList(CuttingOption.SLICED.name(), CuttingOption.LARGE_PIECES.name(),
                        CuttingOption.CHOPS.name()), true, true, "beef-steak-cut.jpg");

        createProduct("Beef Curry Cut", "Beef for rich curries",
                "High-quality beef cut into curry pieces, slow-cooked tenderness. Perfect for Kerala-style beef curry.",
                new BigDecimal("520"), new BigDecimal("7"), 45, 1, beef,
                Arrays.asList(CuttingOption.CURRY_CUT.name(), CuttingOption.SMALL_PIECES.name(),
                        CuttingOption.LARGE_PIECES.name()), true, true, "beef-curry-cut.jpg");

        createProduct("Fresh Fish - Rohu", "Fresh River Fish (whole)",
                "Fresh water Rohu fish, cleaned and scaled. Great for fish curry and fry.",
                new BigDecimal("260"), new BigDecimal("5"), 50, 1, fish,
                Arrays.asList(CuttingOption.WHOLE.name(), CuttingOption.SLICED.name(),
                        CuttingOption.SMALL_PIECES.name()), true, true, "fresh-fish-rohu.jpg");

        createProduct("Pomfret Fish", "Premium Pomfret, cleaned",
                "Premium black pomfret, cleaned and ready to cook. Rich in taste, low in calories.",
                new BigDecimal("480"), new BigDecimal("10"), 20, 1, fish,
                Arrays.asList(CuttingOption.WHOLE.name(), CuttingOption.SLICED.name()), true, true, "pomfret-fish.jpg");

        createProduct("Country Chicken", "Naturally raised desi chicken",
                "Rustic country chicken raised naturally, richer in flavor and protein. Ideal for traditional soup.",
                new BigDecimal("450"), new BigDecimal("0"), 25, 1, countryChicken,
                Arrays.asList(CuttingOption.CURRY_CUT.name(), CuttingOption.WHOLE.name(),
                        CuttingOption.LARGE_PIECES.name()), true, true, "country-chicken.jpg");

        createProduct("Farm Fresh Eggs (Pack of 12)", "Farm fresh eggs",
                "Farm-fresh brown eggs, rich in nutrition. Pack of 12. Ideal for breakfast and baking.",
                new BigDecimal("90"), new BigDecimal("10"), 200, 1, eggs,
                Arrays.asList(CuttingOption.WHOLE.name()), true, true, "farm-fresh-eggs.jpg");

        createProduct("Chicken Tikka (Ready-to-Cook)", "Marinated chicken tikka",
                "Chicken pieces marinated with authentic tikka masala, ready to grill. Just heat and serve.",
                new BigDecimal("340"), new BigDecimal("15"), 60, 1, readyToCook,
                Arrays.asList(CuttingOption.SLICED.name(), CuttingOption.LARGE_PIECES.name()),
                true, true, "chicken-tikka.jpg");

        createProduct("Mutton Seekh Kebab (Ready-to-Cook)", "Ready-to-cook seekh kebabs",
                "Hand-minced mutton seekh kebabs, seasoned with exotic spices. Perfect for BBQ and grilling.",
                new BigDecimal("560"), new BigDecimal("8"), 40, 1, readyToCook,
                Arrays.asList(CuttingOption.WHOLE.name()), true, true, "mutton-seekh-kebab.jpg");

        createProduct("Prawns - Peeled & Cleaned", "Premium peeled prawns",
                "Medium-sized prawns, peeled and cleaned. High-protein seafood, perfect for curries and starters.",
                new BigDecimal("540"), new BigDecimal("10"), 30, 1, specialCuts,
                Arrays.asList(CuttingOption.WHOLE.name(), CuttingOption.SLICED.name(),
                        CuttingOption.SMALL_PIECES.name()), true, true, "prawns.jpg");

        createProduct("Chicken Wings", "Juicy chicken wings",
                "Crispy chicken wings, perfect for appetizers. Great for grilling and frying.",
                new BigDecimal("230"), new BigDecimal("0"), 80, 1, chicken,
                Arrays.asList(CuttingOption.WHOLE.name()), true, true, "chicken-wings.jpg");

        log.info("Sample products created: " + productRepository.count());
    }

    private void createProduct(String name, String shortDesc, String description,
                               BigDecimal price, BigDecimal discount, int stock, int minOrder,
                               Category category, List<String> cuttingOptions,
                               boolean available, boolean freshToday, String imageCode) {
        Product product = new Product();
        product.setName(name);
        product.setShortDescription(shortDesc);
        product.setDescription(description);
        product.setPricePerKg(price);
        product.setDiscountPercent(discount);
        product.setStockQuantity(stock);
        product.setMinOrderQty(minOrder);
        product.setAvailable(available);
        product.setFreshToday(freshToday);
        product.setCategory(category);
        product.setCuttingOptions(cuttingOptions);
        product.setImageUrl("/images/" + imageCode);
        product.setAvgRating(new BigDecimal("4.3"));
        product.setReviewCount(12);
        product = productRepository.save(product);

        Inventory inventory = new Inventory();
        inventory.setProduct(product);
        inventory.setCurrentStock(stock);
        inventory.setMinStock(10);
        inventoryRepository.save(inventory);
    }

    private Category findCategory(List<Category> categories, String name) {
        return categories.stream()
                .filter(c -> c.getName().equals(name))
                .findFirst().orElse(categories.get(0));
    }
}
