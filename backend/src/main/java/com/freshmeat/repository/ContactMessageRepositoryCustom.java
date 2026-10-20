package com.freshmeat.repository;

import com.freshmeat.entity.ContactMessage;

import java.util.List;

public interface ContactMessageRepositoryCustom {

    /** Newest first — replaces the JPA-derived {@code findAllByOrderByCreatedAtDesc}. */
    List<ContactMessage> findAllNewestFirst();

    /**
     * Clears the author of every message written by a user, without deleting the
     * messages themselves (the old {@code UPDATE ... SET user = NULL}).
     */
    void detachUser(Long userId);
}
