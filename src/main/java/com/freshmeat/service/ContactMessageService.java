package com.freshmeat.service;

import com.freshmeat.dto.ContactMessageDTO;
import com.freshmeat.dto.ContactMessageRequest;
import com.freshmeat.entity.ContactMessage;
import com.freshmeat.entity.User;
import com.freshmeat.enums.ContactMessageStatus;
import com.freshmeat.exception.ResourceNotFoundException;
import com.freshmeat.repository.ContactMessageRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class ContactMessageService {

    @Autowired
    private ContactMessageRepository contactMessageRepository;

    @Autowired
    private AuthService authService;

    @Transactional
    public ContactMessageDTO submitMessage(ContactMessageRequest request) {
        // Only logged-in customers can send messages: the customer is resolved
        // from the JWT/security context, so the submitted email can never be
        // spoofed by the frontend.
        User customer = authService.getCurrentUser();

        ContactMessage message = new ContactMessage();
        message.setUser(customer);
        message.setEmail(customer.getEmail());
        message.setMessage(request.getMessage().trim());
        message.setStatus(ContactMessageStatus.NEW);

        return toDTO(contactMessageRepository.save(message));
    }

    public List<ContactMessageDTO> adminGetAll(ContactMessageStatus status) {
        List<ContactMessage> messages = status == null
                ? contactMessageRepository.findAllByOrderByCreatedAtDesc()
                : contactMessageRepository.findByStatusOrderByCreatedAtDesc(status);
        return messages.stream().map(this::toDTO).collect(Collectors.toList());
    }

    public ContactMessageDTO adminGetById(Long id) {
        return toDTO(getMessage(id));
    }

    @Transactional
    public ContactMessageDTO markRead(Long id) {
        ContactMessage message = getMessage(id);
        message.setStatus(ContactMessageStatus.READ);
        return toDTO(contactMessageRepository.save(message));
    }

    @Transactional
    public ContactMessageDTO markResolved(Long id) {
        ContactMessage message = getMessage(id);
        message.setStatus(ContactMessageStatus.RESOLVED);
        return toDTO(contactMessageRepository.save(message));
    }

    @Transactional
    public void adminDelete(Long id) {
        ContactMessage message = getMessage(id);
        contactMessageRepository.delete(message);
    }

    private ContactMessage getMessage(Long id) {
        return contactMessageRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Contact message not found"));
    }

    public ContactMessageDTO toDTO(ContactMessage message) {
        ContactMessageDTO dto = new ContactMessageDTO();
        dto.setId(message.getId());
        dto.setEmail(message.getEmail());
        dto.setMessage(message.getMessage());
        dto.setStatus(message.getStatus() == null ? ContactMessageStatus.NEW.name() : message.getStatus().name());
        dto.setCreatedAt(message.getCreatedAt());
        dto.setUpdatedAt(message.getUpdatedAt());
        if (message.getUser() != null) {
            dto.setUserId(message.getUser().getId());
            dto.setCustomerName(message.getUser().getName());
        }
        return dto;
    }
}