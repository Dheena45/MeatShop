package com.freshmeat.controller;

import com.freshmeat.dto.ContactMessageDTO;
import com.freshmeat.dto.ContactMessageRequest;
import com.freshmeat.exception.ApiResponse;
import com.freshmeat.service.ContactMessageService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/contact/messages")
public class ContactMessageController {

    @Autowired
    private ContactMessageService contactMessageService;

    @PostMapping
    public ResponseEntity<ApiResponse<ContactMessageDTO>> submitMessage(
            @Valid @RequestBody ContactMessageRequest request) {
        contactMessageService.submitMessage(request);
        return ResponseEntity.status(org.springframework.http.HttpStatus.CREATED)
                .body(ApiResponse.ok("Your message has been sent successfully.", null));
    }
}
