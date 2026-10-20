package com.freshmeat.repository;

import com.freshmeat.entity.User;
import com.freshmeat.enums.Role;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;

/**
 * {@link UserRepositoryCustom} implemented with {@link MongoTemplate}.
 * <p>
 * LocalDateTime values are handed to the query untouched: the query mapper uses
 * the very same conversion the document writer uses, so a range boundary always
 * compares equal to a stored value.
 */
public class UserRepositoryCustomImpl implements UserRepositoryCustom {

    private final MongoTemplate mongoTemplate;

    public UserRepositoryCustomImpl(MongoTemplate mongoTemplate) {
        this.mongoTemplate = mongoTemplate;
    }

    @Override
    public List<User> search(String keyword) {
        if (keyword == null || keyword.isBlank()) {
            return new ArrayList<>();
        }
        Pattern contains = Pattern.compile(Pattern.quote(keyword), Pattern.CASE_INSENSITIVE);
        Criteria criteria = new Criteria().orOperator(
                Criteria.where("name").regex(contains),
                Criteria.where("email").regex(contains),
                Criteria.where("phone").regex(contains));
        return mongoTemplate.find(Query.query(criteria), User.class);
    }

    @Override
    public long countNewCustomersBetween(LocalDateTime start, LocalDateTime end) {
        Criteria criteria = Criteria.where("role").is(Role.CUSTOMER)
                .and("createdAt").gte(start).lt(end);
        return mongoTemplate.count(Query.query(criteria), User.class);
    }
}
