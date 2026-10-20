package com.freshmeat.repository;

import com.freshmeat.entity.User;
import com.freshmeat.enums.Role;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface UserRepository extends MongoRepository<User, Long>, UserRepositoryCustom {

    Optional<User> findByEmail(String email);

    Optional<User> findByEmailIgnoreCase(String email);

    boolean existsByEmail(String email);

    boolean existsByEmailIgnoreCase(String email);

    boolean existsByPhone(String phone);

    Optional<User> findByEmailAndEnabledTrue(String email);

    List<User> findByRole(Role role);

    long countByRole(Role role);

    long countByRoleAndEnabled(Role role, Boolean enabled);
}
