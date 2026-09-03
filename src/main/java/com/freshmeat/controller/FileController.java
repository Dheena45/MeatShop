package com.freshmeat.controller;

import com.freshmeat.exception.ApiResponse;
import com.freshmeat.service.FileStorageService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/files")
public class FileController {

    @Autowired
    private FileStorageService fileStorageService;

    @PostMapping("/upload")
    public ApiResponse<Map<String, String>> upload(@RequestParam("file") MultipartFile file) {
        String publicPath = fileStorageService.storeImage(file);

        Map<String, String> result = new HashMap<>();
        result.put("url", publicPath);
        return ApiResponse.ok("File uploaded", result);
    }
}
