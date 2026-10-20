package com.freshmeat.repository;

import com.freshmeat.entity.SiteSettings;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.Optional;

public interface SiteSettingsRepository extends MongoRepository<SiteSettings, Long> {

    Optional<SiteSettings> findFirstByOrderByIdAsc();
}
