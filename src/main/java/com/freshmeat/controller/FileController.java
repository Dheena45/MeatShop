package com.freshmeat.controller;

import com.freshmeat.exception.ApiResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/files")
public class FileController {

    @Value("${app.upload.path}")
    private String uploadPath;

    @Value("${app.base.url}")
    private String baseUrl;

    @PostMapping("/upload")
    public ApiResponse<Map<String, String>> upload(@RequestParam("file") MultipartFile file) {
        if (file.isEmpty()) {
            throw new IllegalArgumentException("File is empty");
        }

        String originalName = file.getOriginalFilename();
        String extension = "";
        if (originalName != null && originalName.contains(".")) {
            extension = originalName.substring(originalName.lastIndexOf("."));
        }

        String fileName = UUID.randomUUID() + extension;
        try {
            Path dir = Paths.get(uploadPath).toAbsolutePath();
            Files.createDirectories(dir);
            Path target = dir.resolve(fileName);
            file.transferTo(target);

            Map<String, String> result = new HashMap<>();
            result.put("url", baseUrl + "/uploads/" + fileName);
            return ApiResponse.ok("File uploaded", result);
        } catch (IOException e) {
            throw new RuntimeException("Failed to upload file", e);
        }
    }
}
