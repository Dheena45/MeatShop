package com.freshmeat.controller.admin;

import com.freshmeat.dto.UserDTO;
import com.freshmeat.entity.User;
import com.freshmeat.enums.Role;
import com.freshmeat.exception.ApiResponse;
import com.freshmeat.exception.BadRequestException;
import com.freshmeat.exception.ResourceNotFoundException;
import com.freshmeat.repository.CartItemRepository;
import com.freshmeat.repository.CartRepository;
import com.freshmeat.repository.ContactMessageRepository;
import com.freshmeat.repository.DeliveryAddressRepository;
import com.freshmeat.repository.OrderRepository;
import com.freshmeat.repository.PasswordResetTokenRepository;
import com.freshmeat.repository.ReviewRepository;
import com.freshmeat.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/admin/customers")
public class AdminCustomerController {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private OrderRepository orderRepository;

    @Autowired
    private ReviewRepository reviewRepository;

    @Autowired
    private DeliveryAddressRepository deliveryAddressRepository;

    @Autowired
    private CartRepository cartRepository;

    @Autowired
    private CartItemRepository cartItemRepository;

    @Autowired
    private PasswordResetTokenRepository passwordResetTokenRepository;

    @Autowired
    private ContactMessageRepository contactMessageRepository;

    @GetMapping
    public ResponseEntity<ApiResponse<List<UserDTO>>> getCustomers(
            @RequestParam(required = false) String search) {
        List<UserDTO> customers;
        if (search != null && !search.isBlank()) {
            customers = userRepository.search(search).stream()
                    .filter(u -> u.getRole() == Role.CUSTOMER)
                    .map(this::toDTO).collect(Collectors.toList());
        } else {
            customers = userRepository.findByRole(Role.CUSTOMER).stream()
                    .map(this::toDTO).collect(Collectors.toList());
        }
        return ResponseEntity.ok(ApiResponse.ok(customers));
    }

    @PutMapping("/{id}/toggle")
    public ResponseEntity<ApiResponse<UserDTO>> toggleCustomer(@PathVariable Long id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Customer not found"));
        user.setEnabled(!user.getEnabled());
        user = userRepository.save(user);
        return ResponseEntity.ok(ApiResponse.ok("Customer status updated", toDTO(user)));
    }

    @Transactional
    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> deleteCustomer(@PathVariable Long id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Customer not found"));

        if (user.getRole() != Role.CUSTOMER) {
            throw new BadRequestException("Only customer accounts can be deleted");
        }

        // Orders are business data that must be preserved. Instead of blocking
        // the deletion, detach the customer from every order by setting the
        // order's user reference to NULL. Order amount, status, date, items and
        // payment details stay unchanged, so dashboard revenue/history survive.
        // Order rows keep a customer_name snapshot, so admin views still show
        // who the order belonged to.
        orderRepository.findByUserIdOrderByCreatedAtDesc(id)
                .forEach(order -> {
                    order.setUser(null);
                    orderRepository.save(order);
                });

        // Remove every remaining record that references the customer through
        // the users foreign key (none of these hold business/revenue data).
        passwordResetTokenRepository.deleteAllByUserId(id);
        reviewRepository.deleteByUserId(id);
        deliveryAddressRepository.deleteByUserId(id);
        contactMessageRepository.detachUser(id);
        cartRepository.findByUserId(id).ifPresent(cart -> {
            cartItemRepository.deleteByCartId(cart.getId());
            cartRepository.delete(cart);
        });

        userRepository.delete(user);

        return ResponseEntity.ok(ApiResponse.ok("Customer deleted successfully.", null));
    }

    private UserDTO toDTO(User user) {
        UserDTO dto = new UserDTO();
        dto.setId(user.getId());
        dto.setName(user.getName());
        dto.setEmail(user.getEmail());
        dto.setPhone(user.getPhone());
        dto.setRole(user.getRole().name());
        dto.setEnabled(user.getEnabled());
        dto.setCreatedAt(user.getCreatedAt());
        return dto;
    }
}
