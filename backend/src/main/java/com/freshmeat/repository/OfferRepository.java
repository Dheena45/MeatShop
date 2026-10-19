package com.freshmeat.repository;

import com.freshmeat.entity.Offer;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;

public interface OfferRepository extends JpaRepository<Offer, Long> {

    List<Offer> findByActiveTrueOrderByCreatedAtDesc();

    List<Offer> findByActiveTrueAndEndDateGreaterThanEqual(LocalDate date);

    long countByActiveTrue();
}
