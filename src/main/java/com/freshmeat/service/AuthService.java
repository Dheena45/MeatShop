package com.freshmeat.service;

import com.freshmeat.dto.AuthRequest;
import com.freshmeat.dto.AuthResponse;
import com.freshmeat.dto.RegisterRequest;
import com.freshmeat.dto.UserDTO;
import com.freshmeat.entity.User;
import com.freshmeat.enums.Role;
import com.freshmeat.exception.DuplicateResourceException;
import com.freshmeat.exception.ResourceNotFoundException;
import com.freshmeat.exception.UnauthorizedException;
import com.freshmeat.repository.CartRepository;
import com.freshmeat.entity.Cart;
import com.freshmeat.repository.UserRepository;
import com.freshmeat.security.JwtUtil;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class AuthService {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private CartRepository cartRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private AuthenticationManager authenticationManager;

    @Autowired
    private JwtUtil jwtUtil;

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new DuplicateResourceException("Email is already registered");
        }
        if (userRepository.existsByPhone(request.getPhone())) {
            throw new DuplicateResourceException("Phone number is already registered");
        }

        User user = new User();
        user.setName(request.getName());
        user.setEmail(request.getEmail());
        user.setPhone(request.getPhone());
        user.setPassword(passwordEncoder.encode(request.getPassword()));
        user.setRole(Role.CUSTOMER);
        user.setEnabled(true);
        user = userRepository.save(user);

        Cart cart = new Cart();
        cart.setUser(user);
        cartRepository.save(cart);

        String token = jwtUtil.generateToken(user.getId(), user.getEmail(), user.getRole().name());
        return new AuthResponse(token, user.getId(), user.getName(), user.getEmail(), user.getRole().name());
    }

    public AuthResponse login(AuthRequest request) {
        authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(request.getEmail(), request.getPassword()));

        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        if (!user.getEnabled()) {
            throw new UnauthorizedException("Account has been disabled");
        }

        String token = jwtUtil.generateToken(user.getId(), user.getEmail(), user.getRole().name());
        return new AuthResponse(token, user.getId(), user.getName(), user.getEmail(), user.getRole().name());
    }

    public User getCurrentUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()) {
            throw new UnauthorizedException("Authentication required");
        }
        String email = authentication.getName();
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
    }

    public List<UserDTO> getAllCustomers() {
        return userRepository.findByRole(Role.CUSTOMER).stream()
                .map(this::toDTO)
                .collect(Collectors.toList());
    }

    public UserDTO getProfile() {
        return toDTO(getCurrentUser());
    }

    @Transactional
    public UserDTO updateProfile(String name, String phone) {
        User user = getCurrentUser();
        user.setName(name);
        user.setPhone(phone);
        user = userRepository.save(user);
        return toDTO(user);
    }

    @Transactional
    public void changePassword(String currentPassword, String newPassword) {
        User user = getCurrentUser();
        if (!passwordEncoder.matches(currentPassword, user.getPassword())) {
            throw new UnauthorizedException("Current password is incorrect");
        }
        user.setPassword(passwordEncoder.encode(newPassword));
        userRepository.save(user);
    }

    public UserDTO toDTO(User user) {
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
