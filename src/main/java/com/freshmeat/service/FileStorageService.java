package com.freshmeat.service;

import com.freshmeat.exception.BadRequestException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

@Service
public class FileStorageService {

    private static final Set<String> ALLOWED_EXTENSIONS =
            Set.of("jpg", "jpeg", "png", "webp");

    private static final long MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

    @Value("${app.upload.path}")
    private String uploadPath;

    /**
     * Validates and stores an uploaded image under the configured upload
     * directory (e.g. uploads/products/). Returns the public URL path to be
     * stored on the product record, e.g. /uploads/name-uuid.jpg
     *
     * WebConfig maps /uploads/** to the upload directory (uploads/products),
     * so the public path is /uploads/<filename>.
     */
    public String storeImage(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new BadRequestException("No image file provided");
        }
        if (file.getSize() > MAX_FILE_SIZE) {
            throw new BadRequestException("Image too large. Maximum size is 5 MB.");
        }

        String originalName = file.getOriginalFilename();
        String extension = originalName != null && originalName.contains(".")
                ? originalName.substring(originalName.lastIndexOf('.') + 1) : "";
        extension = extension.toLowerCase(Locale.ROOT);

        if (!ALLOWED_EXTENSIONS.contains(extension)) {
            throw new BadRequestException("Invalid image type. Allowed: JPG, JPEG, PNG, WebP");
        }

        String fileName = UUID.randomUUID() + "." + extension;
        try {
            Path dir = Paths.get(uploadPath).toAbsolutePath();
            Files.createDirectories(dir);
            Path target = dir.resolve(fileName);
            file.transferTo(target);
            return "/uploads/" + fileName;
        } catch (IOException e) {
            throw new RuntimeException("Failed to store image", e);
        }
    }

    /**
     * Deletes an uploaded file from disk. Only deletes files that live under
     * the uploads/products directory. Returns false (does nothing) for default,
     * shared, or non-upload paths.
     */
    public boolean deleteUploadedFile(String publicPath) {
        if (publicPath == null || !publicPath.startsWith("/uploads/")) {
            return false;
        }
        String fileName = publicPath.substring("/uploads/".length());
        if (fileName.isEmpty() || fileName.contains("..")) {
            return false;
        }
        try {
            Path dir = Paths.get(uploadPath).toAbsolutePath();
            Path target = dir.resolve(fileName).normalize();
            if (!target.startsWith(dir)) {
                return false;
            }
            return Files.deleteIfExists(target);
        } catch (IOException e) {
            return false;
        }
    }
}
