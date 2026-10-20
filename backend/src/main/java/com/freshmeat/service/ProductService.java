package com.freshmeat.service;

import com.freshmeat.dto.ProductDTO;
import com.freshmeat.dto.ProductDetailDTO;
import com.freshmeat.entity.Category;
import com.freshmeat.entity.Order;
import com.freshmeat.entity.Product;
import com.freshmeat.exception.ConflictException;
import com.freshmeat.exception.ResourceNotFoundException;
import com.freshmeat.repository.CartItemRepository;
import com.freshmeat.repository.CategoryRepository;
import com.freshmeat.repository.InventoryRepository;
import com.freshmeat.repository.OrderRepository;
import com.freshmeat.repository.ProductRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Service
public class ProductService {

    @Autowired
    private ProductRepository productRepository;

    @Autowired
    private CategoryRepository categoryRepository;

    @Autowired
    private OrderRepository orderRepository;

    @Autowired
    private CartItemRepository cartItemRepository;

    @Autowired
    private InventoryRepository inventoryRepository;

    @Autowired
    private FileStorageService fileStorageService;

    @Autowired
    private MongoTemplate mongoTemplate;

    public Page<ProductDTO> searchProducts(String search, Long categoryId,
                                           BigDecimal minPrice, BigDecimal maxPrice,
                                           Double minRating, Boolean inStock,
                                           String sort, int page, int size) {
        return searchInternal(true, search, categoryId, minPrice, maxPrice,
                minRating, inStock, sort, page, size);
    }

    public Page<ProductDTO> searchAdminProducts(String search, Long categoryId,
                                                BigDecimal minPrice, BigDecimal maxPrice,
                                                Double minRating, Boolean inStock,
                                                String sort, int page, int size) {
        return searchInternal(false, search, categoryId, minPrice, maxPrice,
                minRating, inStock, sort, page, size);
    }

    /**
     * The JPA {@code Specification} is gone (Mongo has no criteria API for it);
     * the same predicate list is built with Mongo {@link Criteria}. Paging is
     * preserved by counting the matches first and then fetching the requested
     * slice with the matching sort — the same contract as the old
     * {@code findAll(spec, pageable)}.
     * <p>
     * A keyword also matches the category name: matching category ids are
     * resolved first (exactly what the old {@code join} did) rather than
     * denormalising the name into each product.
     */
    private Page<ProductDTO> searchInternal(boolean onlyAvailable, String search, Long categoryId,
                                            BigDecimal minPrice, BigDecimal maxPrice,
                                            Double minRating, Boolean inStock,
                                            String sort, int page, int size) {

        List<Criteria> predicates = new java.util.ArrayList<>();
        if (onlyAvailable) {
            predicates.add(Criteria.where("available").is(true));
        }
        if (search != null && !search.isBlank()) {
            Pattern contains = Pattern.compile(Pattern.quote(search), Pattern.CASE_INSENSITIVE);
            List<Long> matchingCategoryIds = mongoTemplate.find(
                            Query.query(Criteria.where("name").regex(contains)), Category.class)
                    .stream().map(Category::getId).toList();
            predicates.add(new Criteria().orOperator(
                    Criteria.where("name").regex(contains),
                    Criteria.where("shortDescription").regex(contains),
                    Criteria.where("categoryId").in(matchingCategoryIds)));
        }
        if (categoryId != null) {
            predicates.add(Criteria.where("categoryId").is(categoryId));
        }
        if (minPrice != null) {
            predicates.add(Criteria.where("pricePerKg").gte(minPrice));
        }
        if (maxPrice != null) {
            predicates.add(Criteria.where("pricePerKg").lte(maxPrice));
        }
        if (minRating != null) {
            predicates.add(Criteria.where("avgRating").gte(minRating));
        }
        if (inStock != null && inStock) {
            predicates.add(Criteria.where("stockQuantity").gt(0));
        }

        Criteria criteria = predicates.isEmpty()
                ? new Criteria()
                : new Criteria().andOperator(predicates.toArray(new Criteria[0]));

        Sort sortBy = switch (sort == null ? "" : sort) {
            case "price_asc" -> Sort.by("pricePerKg").ascending();
            case "price_desc" -> Sort.by("pricePerKg").descending();
            case "popularity" -> Sort.by("reviewCount").descending();
            case "newest" -> Sort.by("createdAt").descending();
            case "rating" -> Sort.by("avgRating").descending();
            default -> Sort.by("createdAt").descending();
        };

        Query query = Query.query(criteria);
        long total = mongoTemplate.count(query, Product.class);

        Pageable pageable = PageRequest.of(page, size, sortBy);
        query.with(pageable);
        List<ProductDTO> content = toDTOs(mongoTemplate.find(query, Product.class));
        return new PageImpl<>(content, pageable, total);
    }

    public ProductDetailDTO getProductDetail(Long id) {
        Product product = productRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Product not found"));

        ProductDetailDTO dto = new ProductDetailDTO();
        dto.setId(product.getId());
        dto.setName(product.getName());
        dto.setShortDescription(product.getShortDescription());
        dto.setDescription(product.getDescription());
        dto.setPricePerKg(product.getPricePerKg());
        dto.setDiscountPercent(product.getDiscountPercent());
        dto.setEffectivePrice(effectivePrice(product));
        dto.setStockQuantity(product.getStockQuantity());
        dto.setMinOrderQty(product.getMinOrderQty());
        dto.setUnit(product.getUnit());
        dto.setImageUrl(product.getImageUrl());
        dto.setAvailable(product.getAvailable());
        dto.setFreshToday(product.getFreshToday());
        dto.setAvgRating(product.getAvgRating());
        dto.setReviewCount(product.getReviewCount());
        dto.setCategoryId(product.getCategoryId());
        dto.setCategoryName(categoryName(product));
        dto.setCuttingOptions(product.getCuttingOptions());

        return dto;
    }

    public List<ProductDTO> getBestSellers() {
        return toDTOs(productRepository.findTop8ByAvailableTrueOrderByReviewCountDesc());
    }

    public List<ProductDTO> getFreshProducts() {
        return toDTOs(productRepository.findByFreshTodayTrueAndAvailableTrue());
    }

    public List<ProductDTO> getPopularProducts() {
        return toDTOs(productRepository.findPopularProducts().stream().limit(8).toList());
    }

    /**
     * Maps a page of products to DTOs with <b>one</b> extra query for all their
     * category names, instead of one per product (which is what the old JPA
     * {@code @ManyToOne} effectively hid behind Hibernate's first-level cache).
     */
    private List<ProductDTO> toDTOs(List<Product> products) {
        List<Long> categoryIds = products.stream()
                .map(Product::getCategoryId)
                .filter(java.util.Objects::nonNull)
                .distinct()
                .toList();
        Map<Long, String> names = new HashMap<>();
        if (!categoryIds.isEmpty()) {
            categoryRepository.findAllById(categoryIds)
                    .forEach(c -> names.put(c.getId(), c.getName()));
        }
        return products.stream()
                .map(p -> toDTO(p, names.get(p.getCategoryId())))
                .collect(Collectors.toList());
    }

    public ProductDTO createProduct(ProductDTO dto) {
        Category category = categoryRepository.findById(dto.getCategoryId())
                .orElseThrow(() -> new ResourceNotFoundException("Category not found"));

        Product product = new Product();
        applyDTO(product, dto, category);
        product = productRepository.save(product);
        return toDTO(product);
    }

    public ProductDTO updateProduct(Long id, ProductDTO dto) {
        Product product = productRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Product not found"));

        Category category = categoryRepository.findById(product.getCategoryId()).orElse(null);
        if (dto.getCategoryId() != null) {
            category = categoryRepository.findById(dto.getCategoryId())
                    .orElseThrow(() -> new ResourceNotFoundException("Category not found"));
        }

        applyDTO(product, dto, category);
        product = productRepository.save(product);
        return toDTO(product);
    }

    public ProductDTO getAdminProduct(Long id) {
        Product product = productRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Product not found"));
        return toDTO(product);
    }

    public void deleteProduct(Long id) {
        Product product = productRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Product not found"));

        // Preserve historical order data: products referenced by order lines must
        // not be physically removed, otherwise past orders break. Order lines are
        // embedded in the order document now, so the check is a count over orders
        // instead of a join table.
        if (isProductUsedInOrders(id)) {
            throw new ConflictException(
                    "This product cannot be permanently deleted because it is used in existing orders. You can deactivate it instead.");
        }

        // Clean up product-specific references before the hard delete.
        cartItemRepository.deleteByProductId(id);
        inventoryRepository.deleteByProductId(id);
        fileStorageService.deleteUploadedFile(product.getImageUrl());

        productRepository.delete(product);
    }

    public void toggleProduct(Long id) {
        Product product = productRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Product not found"));
        product.setAvailable(!product.getAvailable());
        productRepository.save(product);
    }

    public void updateStock(Long id, Integer quantity) {
        Product product = productRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Product not found"));
        product.setStockQuantity(quantity);
        productRepository.save(product);
    }

    public Product toProduct(ProductDTO dto) {
        Product product = new Product();
        Category category = categoryRepository.findById(dto.getCategoryId())
                .orElseThrow(() -> new ResourceNotFoundException("Category not found"));
        applyDTO(product, dto, category);
        return product;
    }

    private void applyDTO(Product product, ProductDTO dto, Category category) {
        if (dto.getName() != null) product.setName(dto.getName());
        product.setShortDescription(dto.getShortDescription());
        product.setDescription(dto.getDescription());
        if (dto.getPricePerKg() != null) product.setPricePerKg(dto.getPricePerKg());
        if (dto.getDiscountPercent() != null) product.setDiscountPercent(dto.getDiscountPercent());
        if (dto.getStockQuantity() != null) product.setStockQuantity(dto.getStockQuantity());
        if (dto.getMinOrderQty() != null) product.setMinOrderQty(dto.getMinOrderQty());
        if (dto.getUnit() != null && !dto.getUnit().isBlank()) product.setUnit(dto.getUnit().toUpperCase());
        if (dto.getImageUrl() != null) product.setImageUrl(dto.getImageUrl());
        if (dto.getAvailable() != null) product.setAvailable(dto.getAvailable());
        if (dto.getFreshToday() != null) product.setFreshToday(dto.getFreshToday());
        product.setCategory(category);
        if (dto.getCuttingOptions() != null) {
            product.getCuttingOptions().clear();
            product.getCuttingOptions().addAll(dto.getCuttingOptions());
        }
    }

    public ProductDTO toDTO(Product product) {
        return toDTO(product, categoryName(product));
    }

    /** DTO with an already-resolved category name (used by the batch paths). */
    private ProductDTO toDTO(Product product, String categoryName) {
        ProductDTO dto = new ProductDTO();
        dto.setId(product.getId());
        dto.setName(product.getName());
        dto.setShortDescription(product.getShortDescription());
        dto.setDescription(product.getDescription());
        dto.setPricePerKg(product.getPricePerKg());
        dto.setDiscountPercent(product.getDiscountPercent());
        dto.setStockQuantity(product.getStockQuantity());
        dto.setMinOrderQty(product.getMinOrderQty());
        dto.setUnit(product.getUnit());
        dto.setImageUrl(product.getImageUrl());
        dto.setAvailable(product.getAvailable());
        dto.setFreshToday(product.getFreshToday());
        dto.setCategoryId(product.getCategoryId());
        dto.setCategoryName(categoryName);
        dto.setCuttingOptions(product.getCuttingOptions());
        dto.setAvgRating(product.getAvgRating());
        dto.setReviewCount(product.getReviewCount());
        return dto;
    }

    public BigDecimal effectivePrice(Product product) {
        BigDecimal price = product.getPricePerKg();
        BigDecimal discount = product.getDiscountPercent() == null ? BigDecimal.ZERO : product.getDiscountPercent();
        if (discount.compareTo(BigDecimal.ZERO) > 0) {
            BigDecimal discountAmount = price.multiply(discount).divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
            return price.subtract(discountAmount).setScale(2, RoundingMode.HALF_UP);
        }
        return price;
    }

    /**
     * The category name is read from the plain {@code categoryId} rather than from
     * the lazy DBRef: touching a Mongo lazy reference always issues a query, while
     * the id is already in hand.
     */
    private String categoryName(Product product) {
        if (product.getCategoryId() == null) {
            return null;
        }
        return categoryRepository.findById(product.getCategoryId())
                .map(Category::getName)
                .orElse(null);
    }

    private boolean isProductUsedInOrders(Long productId) {
        return mongoTemplate.exists(
                Query.query(Criteria.where("items.productId").is(productId)), Order.class);
    }
}
