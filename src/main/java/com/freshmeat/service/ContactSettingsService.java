package com.freshmeat.service;

import com.freshmeat.dto.ContactSettingsDTO;
import com.freshmeat.entity.ContactSettings;
import com.freshmeat.repository.ContactSettingsRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ContactSettingsService {

    @Autowired
    private ContactSettingsRepository contactSettingsRepository;

    @Transactional
    public ContactSettingsDTO getSettings() {
        return toDTO(getOrCreate());
    }

    @Transactional
    public ContactSettingsDTO updateSettings(ContactSettingsDTO dto) {
        ContactSettings settings = getOrCreate();
        settings.setBusinessDescription(trimNullable(dto.getBusinessDescription()));
        settings.setAddress(trimNullable(dto.getAddress()));
        settings.setPhone(trimNullable(dto.getPhone()));
        settings.setEmail(trimNullable(dto.getEmail()));
        settings.setBusinessHours(trimNullable(dto.getBusinessHours()));
        settings.setFacebookUrl(trimNullable(dto.getFacebookUrl()));
        settings.setInstagramUrl(trimNullable(dto.getInstagramUrl()));
        settings.setTwitterUrl(trimNullable(dto.getTwitterUrl()));
        settings.setYoutubeUrl(trimNullable(dto.getYoutubeUrl()));
        return toDTO(contactSettingsRepository.save(settings));
    }

    private ContactSettings getOrCreate() {
        ContactSettings settings = contactSettingsRepository.findFirstByOrderByIdAsc()
                .orElse(null);
        if (settings != null) return settings;
        return contactSettingsRepository.save(createDefault());
    }

    public static ContactSettings createDefault() {
        ContactSettings settings = new ContactSettings();
        settings.setBusinessDescription("Fresh Cuts. Honest Prices. Delivered Fast. We bring premium quality meat, hygienically processed and delivered fresh to your doorstep.");
        settings.setAddress("12, Meat Market Road, Chennai, Tamil Nadu 600001");
        settings.setPhone("+91 98765 43210");
        settings.setEmail("support@freshmeat.com");
        settings.setBusinessHours("Mon–Sun, 6 AM – 9 PM");
        return settings;
    }

    public static ContactSettingsDTO toDTO(ContactSettings s) {
        ContactSettingsDTO dto = new ContactSettingsDTO();
        dto.setId(s.getId());
        dto.setBusinessDescription(s.getBusinessDescription());
        dto.setAddress(s.getAddress());
        dto.setPhone(s.getPhone());
        dto.setEmail(s.getEmail());
        dto.setBusinessHours(s.getBusinessHours());
        dto.setFacebookUrl(s.getFacebookUrl());
        dto.setInstagramUrl(s.getInstagramUrl());
        dto.setTwitterUrl(s.getTwitterUrl());
        dto.setYoutubeUrl(s.getYoutubeUrl());
        return dto;
    }

    private static String trimNullable(String value) {
        return value == null ? null : value.trim();
    }
}