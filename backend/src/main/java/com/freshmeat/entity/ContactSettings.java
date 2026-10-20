package com.freshmeat.entity;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.annotation.AccessType;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

@Document(collection = "contact_settings")
@AccessType(AccessType.Type.FIELD)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class ContactSettings {

    @Id
    private Long id;

    private String businessDescription;

    private String address;

    private String phone;

    private String email;

    private String businessHours;

    private String facebookUrl;

    private String instagramUrl;

    private String twitterUrl;

    private String youtubeUrl;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;
}
