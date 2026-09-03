package com.freshmeat.service;

import com.freshmeat.dto.ProductDTO;
import com.freshmeat.dto.ProductDetailDTO;
import com.freshmeat.dto.ReviewDTO;
import com.freshmeat.entity.Category;
import com.freshmeat.entity.Product;
import com.freshmeat.entity.Review;
import com.freshmeat.exception.ResourceNotFoundException;
import com.freshmeat.repository.CategoryRepository;
import com.freshmeat.repository.ProductRepository;
import com.freshmeat.repository.ReviewRepository;
import jakarta.persistence.criteria.Predicate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class ProductService {

    @Autowired
    private ProductRepository productRepository;

    @Autowired
    private CategoryRepository categoryRepository;

    @Autowired
    private ReviewRepository reviewRepository;

    public Page<ProductDTO> searchProducts(String search, Long categoryId,
                                           BigDecimal minPrice, BigDecimal maxPrice,
                                           Double minRating, Boolean inStock,
                                           String sort, int page, int size) {

        Specification<Product> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            predicates.add(cb.equal(root.get("available"), true));

            if (search != null && !search.isBlank()) {
                String pattern = "%" + search.toLowerCase() + "%";
                predicates.add(cb.or(
                        cb.like(cb.lower(root.get("name")), pattern),
                        cb.like(cb.lower(root.get("shortDescription")), pattern),
                        cb.like(cb.lower(root.get("category").get("name")), pattern)
                ));
            }

            if (categoryId != null) {
                predicates.add(cb.equal(root.get("category").get("id"), categoryId));
            }

            if (minPrice != null) {
                predicates.add(cb.greaterThanOrEqualTo(root.get("pricePerKg"), minPrice));
            }

            if (maxPrice != null) {
                predicates.add(cb.lessThanOrEqualTo(root.get("pricePerKg"), maxPrice));
            }

            if (minRating != null) {
                predicates.add(cb.greaterThanOrEqualTo(root.get("avgRating"), minRating));
            }

            if (inStock != null && inStock) {
                predicates.add(cb.greaterThan(root.get("stockQuantity"), 0));
            }

            return cb.and(predicates.toArray(new Predicate[0]));
        };

        Sort sortBy = switch (sort == null ? "" : sort) {
            case "price_asc" -> Sort.by("pricePerKg").ascending();
            case "price_desc" -> Sort.by("pricePerKg").descending();
            case "popularity" -> Sort.by("reviewCount").descending();
            case "newest" -> Sort.by("createdAt").descending();
            case "rating" -> Sort.by("avgRating").descending();
            default -> Sort.by("createdAt").descending();
        };

        Pageable pageable = PageRequest.of(page, size, sortBy);
        return productRepository.findAll(spec, pageable).map(this::toDTO);
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
        dto.setImageUrl(product.getImageUrl());
        dto.setAvailable(product.getAvailable());
        dto.setFreshToday(product.getFreshToday());
        dto.setAvgRating(product.getAvgRating());
        dto.setReviewCount(product.getReviewCount());
        dto.setCategoryId(product.getCategory().getId());
        dto.setCategoryName(product.getCategory().getName());
        dto.setCuttingOptions(product.getCuttingOptions());

        List<ReviewDTO> reviewDTOs = reviewRepository.findByProductIdOrderByCreatedAtDesc(id)
                .stream().map(this::toReviewDTO).collect(Collectors.toList());
        dto.setReviews(reviewDTOs);

        return dto;
    }

    public List<ProductDTO> getBestSellers() {
        return productRepository.findTop8ByAvailableTrueOrderByReviewCountDesc()
                .stream().map(this::toDTO).collect(Collectors.toList());
    }

    public List<ProductDTO> getFreshProducts() {
        return productRepository.findByFreshTodayTrueAndAvailableTrue()
                .stream().map(this::toDTO).collect(Collectors.toList());
    }

    public List<ProductDTO> getPopularProducts() {
        return productRepository.findPopularProducts().stream()
                .limit(8).map(this::toDTO).collect(Collectors.toList());
    }

    @Transactional
    public ProductDTO createProduct(ProductDTO dto) {
        Category category = categoryRepository.findById(dto.getCategoryId())
                .orElseThrow(() -> new ResourceNotFoundException("Category not found"));

        Product product = new Product();
        applyDTO(product, dto, category);
        product = productRepository.save(product);
        return toDTO(product);
    }

    @Transactional
    public ProductDTO updateProduct(Long id, ProductDTO dto) {
        Product product = productRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Product not found"));

        Category category = product.getCategory();
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

    @Transactional
    public void deleteProduct(Long id) {
        Product product = productRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Product not found"));
        product.setAvailable(false);
        productRepository.save(product);
    }

    @Transactional
    public void toggleProduct(Long id) {
        Product product = productRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Product not found"));
        product.setAvailable(!product.getAvailable());
        productRepository.save(product);
    }

    @Transactional
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
        ProductDTO dto = new ProductDTO();
        dto.setId(product.getId());
        dto.setName(product.getName());
        dto.setShortDescription(product.getShortDescription());
        dto.setDescription(product.getDescription());
        dto.setPricePerKg(product.getPricePerKg());
        dto.setDiscountPercent(product.getDiscountPercent());
        dto.setStockQuantity(product.getStockQuantity());
        dto.setMinOrderQty(product.getMinOrderQty());
        dto.setImageUrl(product.getImageUrl());
        dto.setAvailable(product.getAvailable());
        dto.setFreshToday(product.getFreshToday());
        dto.setCategoryId(product.getCategory() != null ? product.getCategory().getId() : null);
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

    private ReviewDTO toReviewDTO(Review review) {
        ReviewDTO dto = new ReviewDTO();
        dto.setId(review.getId());
        dto.setUserId(review.getUser().getId());
        dto.setProductId(review.getProduct().getId());
        dto.setUserEmail(maskEmail(review.getUser().getEmail()));
        dto.setRating(review.getRating());
        dto.setComment(review.getComment());
        dto.setCreatedAt(review.getCreatedAt() != null ? review.getCreatedAt().toString() : null);
        return dto;
    }

    private String maskEmail(String email) {
        if (email == null) return "";
        int at = email.indexOf('@');
        if (at <= 1) return email;
        return email.substring(0, 2) + "***" + email.substring(at);
    }
}
