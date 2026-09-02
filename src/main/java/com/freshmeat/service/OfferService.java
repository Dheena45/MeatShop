package com.freshmeat.service;

import com.freshmeat.dto.OfferDTO;
import com.freshmeat.entity.Offer;
import com.freshmeat.exception.ResourceNotFoundException;
import com.freshmeat.repository.OfferRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class OfferService {

    @Autowired
    private OfferRepository offerRepository;

    public List<OfferDTO> getActiveOffers() {
        return offerRepository.findByActiveTrueOrderByCreatedAtDesc()
                .stream().map(this::toDTO).collect(Collectors.toList());
    }

    public List<OfferDTO> getAll() {
        return offerRepository.findAll().stream()
                .map(this::toDTO).collect(Collectors.toList());
    }

    @Transactional
    public OfferDTO createOffer(OfferDTO dto) {
        Offer offer = new Offer();
        applyDTO(offer, dto);
        offer.setActive(true);
        offer = offerRepository.save(offer);
        return toDTO(offer);
    }

    @Transactional
    public OfferDTO updateOffer(Long id, OfferDTO dto) {
        Offer offer = offerRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Offer not found"));
        applyDTO(offer, dto);
        offer = offerRepository.save(offer);
        return toDTO(offer);
    }

    @Transactional
    public void toggleOffer(Long id) {
        Offer offer = offerRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Offer not found"));
        offer.setActive(!offer.getActive());
        offerRepository.save(offer);
    }

    @Transactional
    public void deleteOffer(Long id) {
        offerRepository.deleteById(id);
    }

    private void applyDTO(Offer offer, OfferDTO dto) {
        offer.setTitle(dto.getTitle());
        offer.setDescription(dto.getDescription());
        offer.setDiscountPercent(dto.getDiscountPercent());
        offer.setCode(dto.getCode());
        offer.setProductId(dto.getProductId());
        offer.setCategoryId(dto.getCategoryId());
        offer.setStartDate(dto.getStartDate());
        offer.setEndDate(dto.getEndDate());
        if (dto.getActive() != null) offer.setActive(dto.getActive());
    }

    public OfferDTO toDTO(Offer offer) {
        OfferDTO dto = new OfferDTO();
        dto.setId(offer.getId());
        dto.setTitle(offer.getTitle());
        dto.setDescription(offer.getDescription());
        dto.setDiscountPercent(offer.getDiscountPercent());
        dto.setCode(offer.getCode());
        dto.setProductId(offer.getProductId());
        dto.setCategoryId(offer.getCategoryId());
        dto.setStartDate(offer.getStartDate());
        dto.setEndDate(offer.getEndDate());
        dto.setActive(offer.getActive());
        return dto;
    }
}
