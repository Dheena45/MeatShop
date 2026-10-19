package com.freshmeat.exception;

import lombok.Getter;

@Getter
public class ApiError {
    private final boolean success;
    private final String message;
    private final int status;
    private final long timestamp;

    public ApiError(boolean success, String message, int status) {
        this.success = success;
        this.message = message;
        this.status = status;
        this.timestamp = System.currentTimeMillis();
    }
}
