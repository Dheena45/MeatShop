package com.freshmeat.controller;

import com.freshmeat.dto.AddCartItemRequest;
import com.freshmeat.dto.CartDTO;
import com.freshmeat.dto.UpdateCartItemRequest;
import com.freshmeat.exception.ApiResponse;
import com.freshmeat.service.CartService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/cart")
public class CartController {

    @Autowired
    private CartService cartService;

    @GetMapping
    public ResponseEntity<ApiResponse<CartDTO>> getCart() {
        return ResponseEntity.ok(ApiResponse.ok(cartService.getCart()));
    }

    @PostMapping("/items")
    public ResponseEntity<ApiResponse<CartDTO>> addItem(@Valid @RequestBody AddCartItemRequest request) {
        return ResponseEntity.ok(ApiResponse.ok("Item added to cart", cartService.addItem(request)));
    }

    @PutMapping("/items/{id}")
    public ResponseEntity<ApiResponse<CartDTO>> updateItem(@PathVariable Long id,
                                                           @RequestBody UpdateCartItemRequest request) {
        return ResponseEntity.ok(ApiResponse.ok("Cart updated", cartService.updateItem(id, request)));
    }

    @DeleteMapping("/items/{id}")
    public ResponseEntity<ApiResponse<Void>> removeItem(@PathVariable Long id) {
        cartService.removeItem(id);
        return ResponseEntity.ok(ApiResponse.ok("Item removed", null));
    }

    @DeleteMapping
    public ResponseEntity<ApiResponse<Void>> clearCart() {
        cartService.clearCart();
        return ResponseEntity.ok(ApiResponse.ok("Cart cleared", null));
    }
}
