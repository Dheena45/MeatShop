package com.freshmeat.repository;

import com.freshmeat.entity.ContactMessage;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;

import java.util.List;

public class ContactMessageRepositoryCustomImpl implements ContactMessageRepositoryCustom {

    private final MongoTemplate mongoTemplate;

    public ContactMessageRepositoryCustomImpl(MongoTemplate mongoTemplate) {
        this.mongoTemplate = mongoTemplate;
    }

    @Override
    public List<ContactMessage> findAllNewestFirst() {
        return mongoTemplate.find(
                new Query().with(Sort.by(Sort.Direction.DESC, "createdAt")),
                ContactMessage.class);
    }

    @Override
    public void detachUser(Long userId) {
        if (userId == null) {
            return;
        }
        // Both the plain id and the DBRef are cleared, so the message survives as
        // an anonymous one instead of pointing at a user that no longer exists.
        mongoTemplate.updateMulti(
                Query.query(Criteria.where("userId").is(userId)),
                new Update().unset("user").unset("userId"),
                ContactMessage.class);
    }
}
