package com.freshmeat.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class CategoryDTO {

    private Long id;

    @NotBlank(message = "Category name is required")
    @Size(max = 100)
    private String name;

    @Size(max = 300)
    private String description;

    private String imageUrl;

    private Boolean active = true;
}
