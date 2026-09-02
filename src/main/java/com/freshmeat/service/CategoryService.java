package com.freshmeat.service;

import com.freshmeat.dto.CategoryDTO;
import com.freshmeat.entity.Category;
import com.freshmeat.exception.DuplicateResourceException;
import com.freshmeat.exception.ResourceNotFoundException;
import com.freshmeat.repository.CategoryRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class CategoryService {

    @Autowired
    private CategoryRepository categoryRepository;

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
        if (categoryRepository.existsByName(dto.getName())) {
            throw new DuplicateResourceException("Category already exists: " + dto.getName());
        }
        Category category = new Category();
        category.setName(dto.getName());
        category.setDescription(dto.getDescription());
        category.setImageUrl(dto.getImageUrl());
        category.setActive(dto.getActive() != null ? dto.getActive() : true);
        category = categoryRepository.save(category);
        return toDTO(category);
    }

    @Transactional
    public CategoryDTO updateCategory(Long id, CategoryDTO dto) {
        Category category = getCategory(id);
        category.setName(dto.getName());
        category.setDescription(dto.getDescription());
        category.setImageUrl(dto.getImageUrl());
        if (dto.getActive() != null) category.setActive(dto.getActive());
        category = categoryRepository.save(category);
        return toDTO(category);
    }

    @Transactional
    public void deleteCategory(Long id) {
        Category category = getCategory(id);
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
