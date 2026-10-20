package com.freshmeat.entity;

import com.freshmeat.enums.ContactMessageStatus;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.annotation.AccessType;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.DBRef;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

@Document(collection = "contact_messages")
@AccessType(AccessType.Type.FIELD)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class ContactMessage {

    @Id
    private Long id;

    /**
     * Plain copy of {@link #user}'s id — nullable, because a message can arrive
     * from a logged-out visitor. {@code detachUser} clears both fields.
     */
    @Indexed(name = "idx_contact_messages_user")
    private Long userId;

    @DBRef(lazy = true)
    private User user;

    private String email;

    private String message;

    @Indexed(name = "idx_contact_messages_status")
    private ContactMessageStatus status = ContactMessageStatus.NEW;

    @Indexed(name = "idx_contact_messages_created")
    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    /** Keeps the plain {@link #userId} in sync with the object reference. */
    public void setUser(User user) {
        this.user = user;
        this.userId = user == null ? null : user.getId();
    }
}
