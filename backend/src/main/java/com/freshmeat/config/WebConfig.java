package com.freshmeat.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.nio.file.Paths;

/**
 * Static resource mapping for product images and uploaded files.
 *
 * CORS is intentionally NOT configured here: the application is stateless and
 * secured by Spring Security, so the single {@code CorsConfigurationSource}
 * bean in {@link SecurityConfig} is the one place that decides which browser
 * origins (e.g. the Vite dev server on http://localhost:5173) may call the API.
 * Defining CORS in two places would emit duplicate Access-Control-Allow-Origin
 * headers and break the browser preflight.
 */
@Configuration
public class WebConfig implements WebMvcConfigurer {

    @Value("${app.upload.path}")
    private String uploadPath;

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {

        // Images inside src/main/resources/static/images
        registry.addResourceHandler("/images/**")
                .addResourceLocations("classpath:/static/images/");

        // Uploaded product images are stored under uploads/products.
        // Serve them at /uploads/products/** (current scheme) and keep the
        // legacy /uploads/** handler so older /uploads/<file> references
        // recorded in the DB before the scheme change still resolve.
        String absolutePath = Paths.get(uploadPath)
                .toAbsolutePath()
                .toUri()
                .toString();

        registry.addResourceHandler("/uploads/products/**")
                .addResourceLocations(absolutePath);

        registry.addResourceHandler("/uploads/**")
                .addResourceLocations(absolutePath);
    }
}
