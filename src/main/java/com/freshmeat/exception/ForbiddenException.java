package com.freshmeat.exception;

/** Authenticated, but not allowed to touch this resource. Rendered as HTTP 403. */
public class ForbiddenException extends RuntimeException {

    public ForbiddenException(String message) {
        super(message);
    }
}
