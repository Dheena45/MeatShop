package com.freshmeat.config;

import com.freshmeat.repository.SequenceGenerator;
import org.springframework.data.mongodb.core.mapping.event.BeforeConvertCallback;
import org.springframework.stereotype.Component;

import java.lang.reflect.Method;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Replaces the JPA persistence callbacks that MongoDB has no equivalent for:
 * <ul>
 *   <li>assigns the next sequence id to any document whose {@code id} is still
 *       null (the role {@code @GeneratedValue} played),</li>
 *   <li>sets {@code createdAt} on first write and refreshes {@code updatedAt}
 *       on every write (the role {@code @PrePersist/@PreUpdate} played).</li>
 * </ul>
 * Entities opt in simply by exposing Lombok-generated {@code getId}/{@code setId},
 * {@code getCreatedAt}/{@code setCreatedAt} and {@code getUpdatedAt}/
 * {@code setUpdatedAt} accessors; accessors that do not exist (e.g. an entity
 * without {@code updatedAt}) are silently skipped. Embedded value objects
 * (order items, payments) are never passed through this callback because only
 * the root of a save is converted — their ids and timestamps are set
 * explicitly where they are created.
 * <p>
 * Runs on the {@code BeforeConvert} event, i.e. for both {@code insert} and
 * {@code save} paths of {@code MongoTemplate} and of every Spring Data
 * repository, before the document is written.
 */
@Component
public class MongoEntityLifecycle implements BeforeConvertCallback<Object> {

    private final SequenceGenerator sequenceGenerator;
    private final Map<Class<?>, Accessors> accessorsCache = new ConcurrentHashMap<>();

    public MongoEntityLifecycle(SequenceGenerator sequenceGenerator) {
        this.sequenceGenerator = sequenceGenerator;
    }

    @Override
    public Object onBeforeConvert(Object source, String collection) {
        Accessors a = accessorsCache.computeIfAbsent(source.getClass(), this::resolve);
        try {
            if (a.idGetter != null && a.idSetter != null && a.idGetter.invoke(source) == null) {
                a.idSetter.invoke(source, sequenceGenerator.nextId(source.getClass().getName()));
            }
            if (a.createdAtGetter != null && a.createdAtSetter != null
                    && a.createdAtGetter.invoke(source) == null) {
                a.createdAtSetter.invoke(source, LocalDateTime.now());
            }
            if (a.updatedAtSetter != null) {
                a.updatedAtSetter.invoke(source, LocalDateTime.now());
            }
        } catch (ReflectiveOperationException e) {
            throw new IllegalStateException(
                    "Failed to assign id/timestamps on " + source.getClass().getName(), e);
        }
        return source;
    }

    private Accessors resolve(Class<?> type) {
        return new Accessors(
                findMethod(type, "getId"),
                findMethod(type, "setId", Long.class),
                findMethod(type, "getCreatedAt"),
                findMethod(type, "setCreatedAt", LocalDateTime.class),
                findMethod(type, "getUpdatedAt"),
                findMethod(type, "setUpdatedAt", LocalDateTime.class));
    }

    private Method findMethod(Class<?> type, String name, Class<?>... params) {
        try {
            Method m = type.getMethod(name, params);
            return m.getDeclaringClass() == Object.class ? null : m;
        } catch (NoSuchMethodException e) {
            return null;
        }
    }

    private record Accessors(Method idGetter, Method idSetter,
                             Method createdAtGetter, Method createdAtSetter,
                             Method updatedAtGetter, Method updatedAtSetter) {
    }
}
