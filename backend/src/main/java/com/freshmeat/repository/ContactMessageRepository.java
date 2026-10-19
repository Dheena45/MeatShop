package com.freshmeat.repository;

import com.freshmeat.entity.ContactMessage;
import com.freshmeat.enums.ContactMessageStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface ContactMessageRepository extends JpaRepository<ContactMessage, Long> {

    List<ContactMessage> findAllByOrderByCreatedAtDesc();

    List<ContactMessage> findByStatusOrderByCreatedAtDesc(ContactMessageStatus status);

    @Modifying
    @Query("UPDATE ContactMessage m SET m.user = NULL WHERE m.user.id = :userId")
    void detachUser(@Param("userId") Long userId);
}
