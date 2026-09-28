package com.freshmeat.service;

import com.freshmeat.dto.AuthRequest;
import com.freshmeat.dto.AuthResponse;
import com.freshmeat.dto.RegisterRequest;
import com.freshmeat.dto.UserDTO;
import com.freshmeat.entity.PasswordResetToken;
import com.freshmeat.entity.User;
import com.freshmeat.enums.Role;
import com.freshmeat.exception.BadRequestException;
import com.freshmeat.exception.DuplicateResourceException;
import com.freshmeat.exception.ResourceNotFoundException;
import com.freshmeat.exception.UnauthorizedException;
import com.freshmeat.repository.CartRepository;
import com.freshmeat.entity.Cart;
import com.freshmeat.repository.PasswordResetTokenRepository;
import com.freshmeat.repository.UserRepository;
import com.freshmeat.security.JwtUtil;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.HexFormat;
import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Service
public class AuthService {

    private static final SecureRandom SECURE_RANDOM = new SecureRandom();
    private static final int RESET_TOKEN_VALIDITY_MINUTES = 30;

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

    @Autowired
    private PasswordResetTokenRepository passwordResetTokenRepository;

    @Value("${app.base.url:http://localhost:8082}")
    private String baseUrl;

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        String name = request.getName() == null ? null : request.getName().trim();
        String email = request.getEmail() == null ? null : request.getEmail().trim();
        String phone = request.getPhone() == null ? null : request.getPhone().trim();

        if (!request.getPassword().equals(request.getConfirmPassword())) {
            throw new BadRequestException("Passwords do not match.");
        }

        if (userRepository.existsByEmailIgnoreCase(email)) {
            throw new DuplicateResourceException("Email already registered.");
        }
        if (userRepository.existsByPhone(phone)) {
            throw new DuplicateResourceException("Mobile number already registered.");
        }

        User user = new User();
        user.setName(name);
        user.setEmail(email);
        user.setPhone(phone);
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
        String email = request.getEmail() == null ? null : request.getEmail().trim().toLowerCase();
        authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(email, request.getPassword()));

        User user = userRepository.findByEmailIgnoreCase(email)
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

    @Transactional
    public void forgotPassword(String email) {
        if (email == null || email.isBlank()) {
            throw new BadRequestException("Email is required");
        }
        String normalized = email.trim().toLowerCase();
        userRepository.findByEmail(normalized)
                .filter(User::getEnabled)
                .ifPresent(user -> {
                    passwordResetTokenRepository.deleteAllByUserId(user.getId());
                    String rawToken = generateResetToken();
                    PasswordResetToken reset = new PasswordResetToken();
                    reset.setTokenHash(sha256(rawToken));
                    reset.setUser(user);
                    reset.setExpiresAt(LocalDateTime.now().plusMinutes(RESET_TOKEN_VALIDITY_MINUTES));
                    passwordResetTokenRepository.save(reset);
                    log.info("PASSWORD RESET LINK (dev mode - email delivery not configured): {}/reset-password.html?token={}",
                            baseUrl, rawToken);
                });
    }

    @Transactional
    public void resetPassword(String token, String newPassword) {
        if (token == null || token.isBlank()) {
            throw new BadRequestException("Invalid or expired reset link");
        }
        PasswordResetToken reset = passwordResetTokenRepository.findByTokenHash(sha256(token.trim()))
                .orElseThrow(() -> new BadRequestException("Invalid or expired reset link"));

        if (reset.isUsed()) {
            throw new BadRequestException("This reset link has already been used");
        }
        if (reset.getExpiresAt() == null || reset.getExpiresAt().isBefore(LocalDateTime.now())) {
            passwordResetTokenRepository.delete(reset);
            throw new BadRequestException("This reset link has expired");
        }

        User user = reset.getUser();
        user.setPassword(passwordEncoder.encode(newPassword));
        userRepository.save(user);

        reset.setUsed(true);
        passwordResetTokenRepository.save(reset);
    }

    private String generateResetToken() {
        byte[] bytes = new byte[32];
        SECURE_RANDOM.nextBytes(bytes);
        return HexFormat.of().formatHex(bytes);
    }

    private String sha256(String value) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(md.digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 not available", e);
        }
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
