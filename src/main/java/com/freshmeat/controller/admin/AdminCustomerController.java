package com.freshmeat.controller.admin;

import com.freshmeat.dto.UserDTO;
import com.freshmeat.entity.User;
import com.freshmeat.enums.Role;
import com.freshmeat.exception.ApiResponse;
import com.freshmeat.exception.ResourceNotFoundException;
import com.freshmeat.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/admin/customers")
public class AdminCustomerController {

    @Autowired
    private UserRepository userRepository;

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
