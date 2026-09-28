package com.freshmeat.dto;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class ContactMessageDTO {

    private Long id;
    private Long userId;
    private String customerName;
    private String email;
    private String message;
    private String status;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
