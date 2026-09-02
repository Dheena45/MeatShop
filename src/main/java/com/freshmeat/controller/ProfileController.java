package com.freshmeat.controller;

import com.freshmeat.dto.ChangePasswordRequest;
import com.freshmeat.dto.DeliveryAddressDTO;
import com.freshmeat.dto.UserDTO;
import com.freshmeat.entity.DeliveryAddress;
import com.freshmeat.entity.User;
import com.freshmeat.exception.ApiResponse;
import com.freshmeat.exception.ResourceNotFoundException;
import com.freshmeat.repository.DeliveryAddressRepository;
import com.freshmeat.service.AuthService;
import jakarta.validation.Valid;
import lombok.Data;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api")
public class ProfileController {

    @Autowired
    private AuthService authService;

    @Autowired
    private DeliveryAddressRepository addressRepository;

    @GetMapping("/profile")
    public ResponseEntity<ApiResponse<UserDTO>> getProfile() {
        return ResponseEntity.ok(ApiResponse.ok(authService.getProfile()));
    }

    @PutMapping("/profile")
    public ResponseEntity<ApiResponse<UserDTO>> updateProfile(@RequestBody UpdateProfileRequest request) {
        return ResponseEntity.ok(ApiResponse.ok("Profile updated",
                authService.updateProfile(request.getName(), request.getPhone())));
    }

    @PutMapping("/profile/password")
    public ResponseEntity<ApiResponse<Void>> changePassword(@Valid @RequestBody ChangePasswordRequest request) {
        authService.changePassword(request.getCurrentPassword(), request.getNewPassword());
        return ResponseEntity.ok(ApiResponse.ok("Password changed successfully", null));
    }

    @GetMapping("/addresses")
    public ResponseEntity<ApiResponse<List<DeliveryAddressDTO>>> getMyAddresses() {
        User user = authService.getCurrentUser();
        List<DeliveryAddressDTO> addresses = addressRepository
                .findByUserIdOrderByIsDefaultDescCreatedAtDesc(user.getId())
                .stream().map(this::toDTO).collect(Collectors.toList());
        return ResponseEntity.ok(ApiResponse.ok(addresses));
    }

    @PostMapping("/addresses")
    public ResponseEntity<ApiResponse<DeliveryAddressDTO>> addAddress(@Valid @RequestBody DeliveryAddressDTO dto) {
        User user = authService.getCurrentUser();
        DeliveryAddress address = new DeliveryAddress();
        applyDTO(address, dto);
        address.setUser(user);
        if (Boolean.TRUE.equals(dto.getIsDefault())) {
            clearDefaults(user);
        }
        address = addressRepository.save(address);
        return ResponseEntity.ok(ApiResponse.ok("Address saved", toDTO(address)));
    }

    @PutMapping("/addresses/{id}")
    public ResponseEntity<ApiResponse<DeliveryAddressDTO>> updateAddress(@PathVariable Long id,
                                                                         @Valid @RequestBody DeliveryAddressDTO dto) {
        User user = authService.getCurrentUser();
        DeliveryAddress address = addressRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Address not found"));
        if (!address.getUser().getId().equals(user.getId())) {
            throw new ResourceNotFoundException("Address not found");
        }
        applyDTO(address, dto);
        if (Boolean.TRUE.equals(dto.getIsDefault())) {
            clearDefaults(user);
        }
        address = addressRepository.save(address);
        return ResponseEntity.ok(ApiResponse.ok("Address updated", toDTO(address)));
    }

    @DeleteMapping("/addresses/{id}")
    public ResponseEntity<ApiResponse<Void>> deleteAddress(@PathVariable Long id) {
        User user = authService.getCurrentUser();
        DeliveryAddress address = addressRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Address not found"));
        if (!address.getUser().getId().equals(user.getId())) {
            throw new ResourceNotFoundException("Address not found");
        }
        addressRepository.delete(address);
        return ResponseEntity.ok(ApiResponse.ok("Address deleted", null));
    }

    private void clearDefaults(User user) {
        List<DeliveryAddress> addresses = addressRepository
                .findByUserIdOrderByIsDefaultDescCreatedAtDesc(user.getId());
        for (DeliveryAddress a : addresses) {
            if (Boolean.TRUE.equals(a.getIsDefault())) {
                a.setIsDefault(false);
                addressRepository.save(a);
            }
        }
    }

    private void applyDTO(DeliveryAddress address, DeliveryAddressDTO dto) {
        address.setLabel(dto.getLabel());
        address.setDoorNumber(dto.getDoorNumber());
        address.setStreet(dto.getStreet());
        address.setArea(dto.getArea());
        address.setCity(dto.getCity());
        address.setState(dto.getState());
        address.setPincode(dto.getPincode());
        address.setIsDefault(Boolean.TRUE.equals(dto.getIsDefault()));
    }

    private DeliveryAddressDTO toDTO(DeliveryAddress address) {
        DeliveryAddressDTO dto = new DeliveryAddressDTO();
        dto.setId(address.getId());
        dto.setLabel(address.getLabel());
        dto.setDoorNumber(address.getDoorNumber());
        dto.setStreet(address.getStreet());
        dto.setArea(address.getArea());
        dto.setCity(address.getCity());
        dto.setState(address.getState());
        dto.setPincode(address.getPincode());
        dto.setIsDefault(address.getIsDefault());
        return dto;
    }
}

@Data
class UpdateProfileRequest {
    private String name;
    private String phone;
}
