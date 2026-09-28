package com.freshmeat.dto;

import lombok.Data;

@Data
public class CategorySalesDTO {
    private String category;
    private long quantity;
    private double revenue;
    private double percentage;
}