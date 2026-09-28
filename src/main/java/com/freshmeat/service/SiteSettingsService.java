package com.freshmeat.service;

import com.freshmeat.dto.SiteSettingsDTO;
import com.freshmeat.entity.SiteSettings;
import com.freshmeat.repository.SiteSettingsRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SiteSettingsService {

    @Autowired
    private SiteSettingsRepository siteSettingsRepository;

    @Transactional
    public SiteSettingsDTO getSettings() {
        return toDTO(getOrCreate());
    }

    @Transactional
    public SiteSettingsDTO updateSettings(SiteSettingsDTO dto) {
        SiteSettings settings = getOrCreate();
        settings.setPremiumCuts(dto.getPremiumCuts().trim());
        settings.setHappyCustomers(dto.getHappyCustomers().trim());
        return toDTO(siteSettingsRepository.save(settings));
    }

    private SiteSettings getOrCreate() {
        SiteSettings settings = siteSettingsRepository.findFirstByOrderByIdAsc()
                .orElse(null);
        if (settings != null) return settings;
        return siteSettingsRepository.save(createDefault());
    }

    public static SiteSettings createDefault() {
        SiteSettings settings = new SiteSettings();
        settings.setPremiumCuts("500+");
        settings.setHappyCustomers("10K+");
        return settings;
    }

    public static SiteSettingsDTO toDTO(SiteSettings s) {
        SiteSettingsDTO dto = new SiteSettingsDTO();
        dto.setId(s.getId());
        dto.setPremiumCuts(s.getPremiumCuts());
        dto.setHappyCustomers(s.getHappyCustomers());
        return dto;
    }
}