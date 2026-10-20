package com.freshmeat.repository;

import com.freshmeat.entity.PasswordResetToken;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.Optional;

public interface PasswordResetTokenRepository extends MongoRepository<PasswordResetToken, Long> {

    Optional<PasswordResetToken> findByTokenHash(String tokenHash);

    /** Derived delete — the old bulk JPQL delete now runs on the stored {@code userId}. */
    void deleteByUserId(Long userId);
}
