package com.freshmeat.repository;

import com.mongodb.client.MongoCollection;
import com.mongodb.client.model.Filters;
import com.mongodb.client.model.FindOneAndUpdateOptions;
import com.mongodb.client.model.ReturnDocument;
import com.mongodb.client.model.Updates;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.bson.Document;
import org.springframework.data.mongodb.MongoDatabaseFactory;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

/**
 * Hands out the numeric ids used by every document.
 * <p>
 * MySQL gave every table an auto-increment primary key; MongoDB only
 * auto-generates {@code ObjectId}s, which would have changed every id in the
 * public JSON API from a number to a string. Instead each insert asks for the
 * next value of a per-entity counter with a single atomic
 * {@code findAndModify(..., {$inc: {seq: 1}}, upsert)}, so ids stay {@code Long}
 * end to end: DTOs, path variables and the JWT payload are untouched.
 * <p>
 * Talks to the database through the raw driver (not {@code MongoTemplate}) on
 * purpose: the MongoTemplate bean depends on this class through the entity
 * lifecycle callback, so a MongoOperations dependency here would be circular.
 */
@Slf4j
@Component
public class SequenceGenerator {

    private static final String COLLECTION = "sequences";

    private final MongoDatabaseFactory databaseFactory;

    public SequenceGenerator(MongoDatabaseFactory databaseFactory) {
        this.databaseFactory = databaseFactory;
    }

    /**
     * Makes sure the counter collection exists before the first entity is saved.
     * <p>
     * A failure here is logged and swallowed on purpose: the collection is only
     * a shortcut, and the {@code upsert} in {@link #nextId} creates it lazily on
     * first use anyway. Aborting startup because the database was a moment away
     * would turn a transient network blip into a dead deployment.
     */
    @PostConstruct
    void ensureCollectionExists() {
        try {
            List<String> names = databaseFactory.getMongoDatabase()
                    .listCollectionNames().into(new ArrayList<>());
            if (!names.contains(COLLECTION)) {
                databaseFactory.getMongoDatabase().createCollection(COLLECTION);
            }
        } catch (RuntimeException ex) {
            log.warn("Could not pre-create the '{}' collection (it will be created on "
                    + "first use): {}", COLLECTION, ex.getMessage());
        }
    }

    /**
     * @param key fully qualified entity class name; one counter per entity type
     * @return the next value for that entity type, starting at 1
     */
    public long nextId(String key) {
        MongoCollection<Document> counters =
                databaseFactory.getMongoDatabase().getCollection(COLLECTION, Document.class);
        Document counter = counters.findOneAndUpdate(
                Filters.eq("_id", key),
                Updates.inc("seq", 1L),
                new FindOneAndUpdateOptions()
                        .upsert(true)
                        .returnDocument(ReturnDocument.AFTER));
        if (counter == null || !(counter.get("seq") instanceof Number seq)) {
            return 1L;
        }
        return seq.longValue();
    }
}
