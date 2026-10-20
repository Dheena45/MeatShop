package com.freshmeat.entity;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.annotation.AccessType;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.DBRef;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

@Document(collection = "password_reset_tokens")
@AccessType(AccessType.Type.FIELD)
@Getter
@Setter
@NoArgsConstructor
public class PasswordResetToken {

    @Id
    private Long id;

    @Indexed(name = "idx_prt_token_hash", unique = true)
    private String tokenHash;

    /** Plain copy of {@link #user}'s id — what the token lookup filters on. */
    @Indexed(name = "idx_prt_user_id")
    private Long userId;

    @DBRef(lazy = true)
    private User user;

    private LocalDateTime expiresAt;

    private boolean used = false;

    private LocalDateTime createdAt;

    /** Keeps the plain {@link #userId} in sync with the object reference. */
    public void setUser(User user) {
        this.user = user;
        this.userId = user == null ? null : user.getId();
    }
}
