package com.freshmeat.repository;

import com.freshmeat.entity.ContactMessage;
import com.freshmeat.enums.ContactMessageStatus;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface ContactMessageRepository extends MongoRepository<ContactMessage, Long>,
        ContactMessageRepositoryCustom {

    List<ContactMessage> findByStatusOrderByCreatedAtDesc(ContactMessageStatus status);
}
