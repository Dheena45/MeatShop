package com.freshmeat.service;

import com.freshmeat.dto.AddCartItemRequest;
import com.freshmeat.dto.CartDTO;
import com.freshmeat.dto.CartItemDTO;
import com.freshmeat.dto.UpdateCartItemRequest;
import com.freshmeat.entity.Cart;
import com.freshmeat.entity.CartItem;
import com.freshmeat.entity.Product;
import com.freshmeat.entity.User;
import com.freshmeat.enums.CuttingOption;
import com.freshmeat.exception.BadRequestException;
import com.freshmeat.exception.ResourceNotFoundException;
import com.freshmeat.exception.StockException;
import com.freshmeat.repository.CartItemRepository;
import com.freshmeat.repository.CartRepository;
import com.freshmeat.repository.ProductRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class CartService {

    @Autowired
    private CartRepository cartRepository;

    @Autowired
    private CartItemRepository cartItemRepository;

    @Autowired
    private ProductRepository productRepository;

    @Autowired
    private AuthService authService;

    @Autowired
    private ProductService productService;

    private Cart getOrCreateCart(User user) {
        return cartRepository.findByUser(user).orElseGet(() -> {
            Cart cart = new Cart();
            cart.setUser(user);
            return cartRepository.save(cart);
        });
    }

    public CartDTO getCart() {
        User user = authService.getCurrentUser();
        Cart cart = getOrCreateCart(user);

        List<CartItemDTO> items = cartItemRepository.findByCartIdOrderByCreatedAtAsc(cart.getId())
                .stream().map(this::toDTO).collect(Collectors.toList());

        CartDTO dto = new CartDTO();
        dto.setCartId(cart.getId());
        dto.setItems(items);
        dto.setTotalItems(items.stream().mapToInt(CartItemDTO::getQuantity).sum());
        dto.setSubtotal(items.stream().map(CartItemDTO::getSubtotal).reduce(BigDecimal.ZERO, BigDecimal::add));
        BigDecimal discount = items.stream()
                .map(i -> i.getUnitPrice().subtract(i.getEffectiveUnitPrice()).multiply(BigDecimal.valueOf(i.getQuantity())))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        dto.setDiscount(discount);
        return dto;
    }

    @Transactional
    public CartDTO addItem(AddCartItemRequest request) {
        User user = authService.getCurrentUser();
        Cart cart = getOrCreateCart(user);

        Product product = productRepository.findById(request.getProductId())
                .orElseThrow(() -> new ResourceNotFoundException("Product not found"));

        if (!product.getAvailable()) {
            throw new BadRequestException("Product is not available");
        }

        int qty = request.getQuantity() == null ? 1 : request.getQuantity();
        if (qty < product.getMinOrderQty()) {
            throw new BadRequestException("Minimum order quantity is " + product.getMinOrderQty() + " KG");
        }
        if (qty > product.getStockQuantity()) {
            throw new StockException("Only " + product.getStockQuantity() + " KG available in stock");
        }

        String cutting = request.getCuttingOption();
        if (cutting == null || cutting.isBlank()) {
            cutting = product.getCuttingOptions().isEmpty() ? CuttingOption.WHOLE.name() : product.getCuttingOptions().get(0);
        } else {
            validateCutting(product, cutting);
        }

        BigDecimal unitPrice = productService.effectivePrice(product);
        final String finalCutting = cutting;

        CartItem existing = cartItemRepository.findByCartIdAndProductId(cart.getId(), product.getId())
                .filter(ci -> finalCutting.equals(ci.getCuttingOption()))
                .orElse(null);

        if (existing != null) {
            int newQty = existing.getQuantity() + qty;
            if (newQty > product.getStockQuantity()) {
                throw new StockException("Only " + product.getStockQuantity() + " KG available in stock");
            }
            existing.setQuantity(newQty);
            existing.setSubtotal(unitPrice.multiply(BigDecimal.valueOf(newQty)));
            cartItemRepository.save(existing);
        } else {
            CartItem item = new CartItem();
            item.setCart(cart);
            item.setProduct(product);
            item.setQuantity(qty);
            item.setCuttingOption(cutting);
            item.setUnitPrice(unitPrice);
            item.setSubtotal(unitPrice.multiply(BigDecimal.valueOf(qty)));
            cartItemRepository.save(item);
        }

        return getCart();
    }

    @Transactional
    public CartDTO updateItem(Long itemId, UpdateCartItemRequest request) {
        User user = authService.getCurrentUser();
        Cart cart = getOrCreateCart(user);

        CartItem item = cartItemRepository.findByCartIdAndId(cart.getId(), itemId)
                .orElseThrow(() -> new ResourceNotFoundException("Cart item not found"));

        Product product = item.getProduct();

        if (request.getQuantity() != null) {
            if (request.getQuantity() < product.getMinOrderQty()) {
                throw new BadRequestException("Minimum order quantity is " + product.getMinOrderQty() + " KG");
            }
            if (request.getQuantity() > product.getStockQuantity()) {
                throw new StockException("Only " + product.getStockQuantity() + " KG available in stock");
            }
            item.setQuantity(request.getQuantity());
        }

        if (request.getCuttingOption() != null && !request.getCuttingOption().isBlank()) {
            validateCutting(product, request.getCuttingOption());
            item.setCuttingOption(request.getCuttingOption());
        }

        item.setSubtotal(item.getUnitPrice().multiply(BigDecimal.valueOf(item.getQuantity())));
        cartItemRepository.save(item);

        return getCart();
    }

    @Transactional
    public void removeItem(Long itemId) {
        User user = authService.getCurrentUser();
        Cart cart = getOrCreateCart(user);
        CartItem item = cartItemRepository.findByCartIdAndId(cart.getId(), itemId)
                .orElseThrow(() -> new ResourceNotFoundException("Cart item not found"));
        cartItemRepository.delete(item);
    }

    @Transactional
    public void clearCart() {
        User user = authService.getCurrentUser();
        Cart cart = getOrCreateCart(user);
        cartItemRepository.deleteByCartId(cart.getId());
    }

    public List<CartItem> getActiveCartItems(User user) {
        Cart cart = getOrCreateCart(user);
        return cartItemRepository.findByCartIdOrderByCreatedAtAsc(cart.getId());
    }

    private void validateCutting(Product product, String cutting) {
        if (product.getCuttingOptions().isEmpty()) {
            throw new BadRequestException("This product does not support cutting options");
        }
        boolean valid = product.getCuttingOptions().stream()
                .anyMatch(option -> option.equalsIgnoreCase(cutting));
        if (!valid) {
            throw new BadRequestException("Invalid cutting option: " + cutting);
        }
    }

    private CartItemDTO toDTO(CartItem item) {
        Product product = item.getProduct();
        CartItemDTO dto = new CartItemDTO();
        dto.setId(item.getId());
        dto.setProductId(product.getId());
        dto.setProductName(product.getName());
        dto.setProductImage(product.getImageUrl());
        dto.setCategoryName(product.getCategory() != null ? product.getCategory().getName() : "");
        dto.setQuantity(item.getQuantity());
        dto.setCuttingOption(item.getCuttingOption());
        dto.setUnitPrice(item.getUnitPrice());
        dto.setEffectiveUnitPrice(productService.effectivePrice(product));
        dto.setSubtotal(item.getSubtotal());
        dto.setAvailableStock(product.getStockQuantity());
        dto.setAvailable(product.getAvailable());
        return dto;
    }
}
