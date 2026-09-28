package com.freshmeat.dto;

import lombok.Data;

@Data
public class RevenueTrendPointDTO {
    private String label;
    private String shortLabel;
    private double revenue;
    private long orders;
}