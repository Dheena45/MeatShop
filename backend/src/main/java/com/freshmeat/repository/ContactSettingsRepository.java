package com.freshmeat.repository;

import com.freshmeat.entity.ContactSettings;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.Optional;

public interface ContactSettingsRepository extends MongoRepository<ContactSettings, Long> {

    Optional<ContactSettings> findFirstByOrderByIdAsc();
}
