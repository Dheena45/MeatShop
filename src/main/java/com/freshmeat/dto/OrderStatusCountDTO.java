package com.freshmeat.dto;

import lombok.Data;

@Data
public class OrderStatusCountDTO {
    private String status;
    private long count;
}