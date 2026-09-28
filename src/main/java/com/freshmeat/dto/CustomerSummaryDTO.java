package com.freshmeat.dto;

import lombok.Data;

@Data
public class CustomerSummaryDTO {
    private long total;
    private long active;
    private long inactive;
    private long newThisMonth;
}