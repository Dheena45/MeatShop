package com.freshmeat.service;

import com.freshmeat.dto.CategoryDTO;
import com.freshmeat.entity.Category;
import com.freshmeat.exception.BadRequestException;
import com.freshmeat.exception.ConflictException;
import com.freshmeat.exception.DuplicateResourceException;
import com.freshmeat.exception.ResourceNotFoundException;
import com.freshmeat.repository.CategoryRepository;
import com.freshmeat.repository.ProductRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class CategoryService {

    @Autowired
    private CategoryRepository categoryRepository;

    @Autowired
    private ProductRepository productRepository;

    public List<CategoryDTO> getAllActive() {
        return categoryRepository.findByActiveTrueOrderByNameAsc().stream()
                .map(this::toDTO).collect(Collectors.toList());
    }

    public List<CategoryDTO> getAll() {
        return categoryRepository.findAll().stream()
                .map(this::toDTO).collect(Collectors.toList());
    }

    public Category getCategory(Long id) {
        return categoryRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Category not found"));
    }

    @Transactional
    public CategoryDTO createCategory(CategoryDTO dto) {
        String name = dto.getName() == null ? null : dto.getName().trim();
        if (name == null || name.isBlank()) {
            throw new BadRequestException("Category name is required");
        }
        if (categoryRepository.findByNameIgnoreCase(name).isPresent()) {
            throw new DuplicateResourceException("Category already exists: " + name);
        }
        Category category = new Category();
        category.setName(name);
        category.setDescription(dto.getDescription() != null ? dto.getDescription().trim() : dto.getDescription());
        category.setImageUrl(dto.getImageUrl());
        category.setActive(dto.getActive() != null ? dto.getActive() : true);
        category = categoryRepository.save(category);
        return toDTO(category);
    }

    @Transactional
    public CategoryDTO updateCategory(Long id, CategoryDTO dto) {
        Category category = getCategory(id);
        String name = dto.getName() == null ? null : dto.getName().trim();
        if (name == null || name.isBlank()) {
            throw new BadRequestException("Category name is required");
        }
        categoryRepository.findByNameIgnoreCase(name).ifPresent(existing -> {
            if (!existing.getId().equals(id)) {
                throw new DuplicateResourceException("Category already exists: " + name);
            }
        });
        category.setName(name);
        category.setDescription(dto.getDescription() != null ? dto.getDescription().trim() : dto.getDescription());
        category.setImageUrl(dto.getImageUrl());
        if (dto.getActive() != null) category.setActive(dto.getActive());
        category = categoryRepository.save(category);
        return toDTO(category);
    }

    @Transactional
    public void deleteCategory(Long id) {
        Category category = getCategory(id);
        if (productRepository.countByCategoryId(id) > 0) {
            throw new ConflictException("This category cannot be deleted because products are associated with it.");
        }
        category.setActive(false);
        categoryRepository.save(category);
    }

    public CategoryDTO toDTO(Category category) {
        CategoryDTO dto = new CategoryDTO();
        dto.setId(category.getId());
        dto.setName(category.getName());
        dto.setDescription(category.getDescription());
        dto.setImageUrl(category.getImageUrl());
        dto.setActive(category.getActive());
        return dto;
    }
}

