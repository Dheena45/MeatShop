package com.freshmeat.entity;

import com.freshmeat.enums.Role;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.annotation.AccessType;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

/**
 * MongoDB document. Numeric id, unique e-mail and unique phone are all
 * preserved from the MySQL schema: ids come from
 * {@link com.freshmeat.repository.SequenceGenerator} (via the entity lifecycle
 * callback) and the unique indexes from the {@link Indexed} annotations
 * (auto-index-creation is enabled).
 */
@Document(collection = "users")
@AccessType(AccessType.Type.FIELD)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class User {

    @Id
    private Long id;

    private String name;

    @Indexed(name = "idx_users_email", unique = true)
    private String email;

    @Indexed(name = "idx_users_phone", unique = true)
    private String phone;

    private String password;

    @Indexed(name = "idx_users_role")
    private Role role = Role.CUSTOMER;

    private Boolean enabled = true;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;
}
