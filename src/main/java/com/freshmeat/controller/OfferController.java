package com.freshmeat.controller;

import com.freshmeat.dto.OfferDTO;
import com.freshmeat.exception.ApiResponse;
import com.freshmeat.service.OfferService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/offers")
public class OfferController {

    @Autowired
    private OfferService offerService;

    @GetMapping("/public")
    public ResponseEntity<ApiResponse<List<OfferDTO>>> getActiveOffers() {
        return ResponseEntity.ok(ApiResponse.ok(offerService.getActiveOffers()));
    }

    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<List<OfferDTO>>> getAllOffers() {
        return ResponseEntity.ok(ApiResponse.ok(offerService.getAll()));
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<OfferDTO>> createOffer(@Valid @RequestBody OfferDTO dto) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok("Offer created", offerService.createOffer(dto)));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<OfferDTO>> updateOffer(@PathVariable Long id,
                                                             @Valid @RequestBody OfferDTO dto) {
        return ResponseEntity.ok(ApiResponse.ok("Offer updated", offerService.updateOffer(id, dto)));
    }

    @PutMapping("/{id}/toggle")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<Void>> toggleOffer(@PathVariable Long id) {
        offerService.toggleOffer(id);
        return ResponseEntity.ok(ApiResponse.ok("Offer status updated", null));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<Void>> deleteOffer(@PathVariable Long id) {
        offerService.deleteOffer(id);
        return ResponseEntity.ok(ApiResponse.ok("Offer deleted", null));
    }
}
