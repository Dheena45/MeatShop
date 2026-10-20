package com.freshmeat.repository;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

/**
 * One counter per entity type. Mongo has no auto-increment column, so the
 * {@code _id} values the REST API already exposes as numbers are handed out by
 * an atomic {@code $inc} against this document — one round trip, no gaps that
 * matter, and two application instances can never receive the same value.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "sequences")
public class Sequence {

    /** Fully qualified entity class name, e.g. {@code com.freshmeat.entity.Order}. */
    @Id
    private String key;

    private Long seq;
}
