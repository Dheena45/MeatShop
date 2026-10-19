package com.freshmeat.repository;

import com.freshmeat.entity.ContactSettings;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface ContactSettingsRepository extends JpaRepository<ContactSettings, Long> {

    Optional<ContactSettings> findFirstByOrderByIdAsc();
}