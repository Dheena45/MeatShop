package com.freshmeat.controller;

import com.freshmeat.dto.ProductDTO;
import com.freshmeat.dto.ProductDetailDTO;
import com.freshmeat.exception.ApiResponse;
import com.freshmeat.service.ProductService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;

@RestController
@RequestMapping("/api/products")
public class ProductController {

    @Autowired
    private ProductService productService;

    @GetMapping
    public ResponseEntity<ApiResponse<Page<ProductDTO>>> search(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) Long categoryId,
            @RequestParam(required = false) BigDecimal minPrice,
            @RequestParam(required = false) BigDecimal maxPrice,
            @RequestParam(required = false) Double minRating,
            @RequestParam(required = false) Boolean inStock,
            @RequestParam(required = false) String sort,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "12") int size) {

        Page<ProductDTO> products = productService.searchProducts(
                search, categoryId, minPrice, maxPrice, minRating, inStock, sort, page, size);
        return ResponseEntity.ok(ApiResponse.ok(products));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<ProductDetailDTO>> getProduct(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(productService.getProductDetail(id)));
    }

    @GetMapping("/list/best-sellers")
    public ResponseEntity<ApiResponse<List<ProductDTO>>> getBestSellers() {
        return ResponseEntity.ok(ApiResponse.ok(productService.getBestSellers()));
    }

    @GetMapping("/list/fresh")
    public ResponseEntity<ApiResponse<List<ProductDTO>>> getFresh() {
        return ResponseEntity.ok(ApiResponse.ok(productService.getFreshProducts()));
    }

    @GetMapping("/list/popular")
    public ResponseEntity<ApiResponse<List<ProductDTO>>> getPopular() {
        return ResponseEntity.ok(ApiResponse.ok(productService.getPopularProducts()));
    }
}
