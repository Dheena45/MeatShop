package com.freshmeat.repository;

import com.freshmeat.entity.User;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Hand-written Mongo queries that a derived query cannot express: case-insensitive
 * "contains" searches (the keyword is quoted, so a name like {@code a.b*} can
 * never be read as a regular expression) and a date-range count.
 */
public interface UserRepositoryCustom {

    /** Case-insensitive match on name/e-mail plus a phone "contains". */
    List<User> search(String keyword);

    long countNewCustomersBetween(LocalDateTime start, LocalDateTime end);
}
