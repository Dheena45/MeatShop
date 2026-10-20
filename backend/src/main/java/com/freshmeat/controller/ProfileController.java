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
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
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
    public ResponseEntity<ApiResponse<UserDTO>> updateProfile(@Valid @RequestBody UpdateProfileRequest request) {
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

        // Reuse an identical address instead of writing a duplicate row. This is
        // what keeps repeat checkouts from piling up the same address.
        DeliveryAddress existing = findMatching(user, dto);
        if (existing != null) {
            boolean promoted = false;
            if (Boolean.TRUE.equals(dto.getIsDefault()) && !Boolean.TRUE.equals(existing.getIsDefault())) {
                clearDefaults(user, existing.getId());
                existing.setIsDefault(true);
                existing = addressRepository.save(existing);
                promoted = true;
            }
            return ResponseEntity.ok(ApiResponse.ok(
                    promoted ? "Address saved as default" : "Address already saved", toDTO(existing)));
        }

        DeliveryAddress address = new DeliveryAddress();
        address.setUser(user);
        applyDTO(address, dto);
        if (Boolean.TRUE.equals(dto.getIsDefault())) {
            clearDefaults(user, null);
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
        if (!user.getId().equals(address.getUserId())) {
            throw new ResourceNotFoundException("Address not found");
        }
        applyDTO(address, dto);
        if (Boolean.TRUE.equals(dto.getIsDefault())) {
            // Exclude the address being saved so its freshly-set default flag is
            // not immediately cleared by the sweep over the other rows.
            clearDefaults(user, address.getId());
        }
        address = addressRepository.save(address);
        return ResponseEntity.ok(ApiResponse.ok("Address updated", toDTO(address)));
    }

    @DeleteMapping("/addresses/{id}")
    public ResponseEntity<ApiResponse<Void>> deleteAddress(@PathVariable Long id) {
        User user = authService.getCurrentUser();
        DeliveryAddress address = addressRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Address not found"));
        if (!user.getId().equals(address.getUserId())) {
            throw new ResourceNotFoundException("Address not found");
        }
        addressRepository.delete(address);
        return ResponseEntity.ok(ApiResponse.ok("Address deleted", null));
    }

    /**
     * Clears the default flag from the customer's other addresses. {@code keepId}
     * (when non-null) is left untouched so promoting or updating a single address
     * to default does not immediately undo itself.
     */
    private void clearDefaults(User user, Long keepId) {
        List<DeliveryAddress> addresses = addressRepository
                .findByUserIdOrderByIsDefaultDescCreatedAtDesc(user.getId());
        for (DeliveryAddress a : addresses) {
            if (Boolean.TRUE.equals(a.getIsDefault())
                    && (keepId == null || !keepId.equals(a.getId()))) {
                a.setIsDefault(false);
                addressRepository.save(a);
            }
        }
    }

    /** Finds an already-saved address with exactly the same delivery details. */
    private DeliveryAddress findMatching(User user, DeliveryAddressDTO dto) {
        List<DeliveryAddress> addresses = addressRepository
                .findByUserIdOrderByIsDefaultDescCreatedAtDesc(user.getId());
        for (DeliveryAddress a : addresses) {
            if (sameField(a.getDoorNumber(), dto.getDoorNumber())
                    && sameField(a.getStreet(), dto.getStreet())
                    && sameField(a.getArea(), dto.getArea())
                    && sameField(a.getCity(), dto.getCity())
                    && sameField(a.getState(), dto.getState())
                    && sameField(a.getPincode(), dto.getPincode())) {
                return a;
            }
        }
        return null;
    }

    private static boolean sameField(String left, String right) {
        String l = left == null ? "" : left.trim().toLowerCase();
        String r = right == null ? "" : right.trim().toLowerCase();
        return l.equals(r);
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

    @NotBlank(message = "Mobile number is required")
    @Pattern(regexp = "^[6-9][0-9]{9}$", message = "Enter a valid 10-digit mobile number starting with 6, 7, 8, or 9.")
    private String phone;
}
