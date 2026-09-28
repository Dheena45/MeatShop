package com.freshmeat.controller.admin;

import com.freshmeat.dto.ContactMessageDTO;
import com.freshmeat.enums.ContactMessageStatus;
import com.freshmeat.exception.ApiResponse;
import com.freshmeat.service.ContactMessageService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/admin/contact-messages")
@PreAuthorize("hasRole('ADMIN')")
public class AdminContactMessageController {

    @Autowired
    private ContactMessageService contactMessageService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<ContactMessageDTO>>> getMessages(
            @RequestParam(required = false) ContactMessageStatus status) {
        return ResponseEntity.ok(ApiResponse.ok(contactMessageService.adminGetAll(status)));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<ContactMessageDTO>> getMessage(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(contactMessageService.adminGetById(id)));
    }

    @PutMapping("/{id}/read")
    public ResponseEntity<ApiResponse<ContactMessageDTO>> markRead(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok("Message marked as read",
                contactMessageService.markRead(id)));
    }

    @PutMapping("/{id}/resolve")
    public ResponseEntity<ApiResponse<ContactMessageDTO>> markResolved(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok("Message marked as resolved",
                contactMessageService.markResolved(id)));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> deleteMessage(@PathVariable Long id) {
        contactMessageService.adminDelete(id);
        return ResponseEntity.ok(ApiResponse.ok("Message deleted", null));
    }
}
