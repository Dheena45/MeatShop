package com.freshmeat.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.mongodb.MongoDatabaseFactory;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.convert.MongoConverter;
import org.springframework.data.mapping.callback.EntityCallbacks;

/**
 * Boot's auto-configured {@code MongoTemplate} never picks entity callbacks up
 * from the application context, so the template is declared here in order to
 * install our own lifecycle callback. It performs the two jobs the JPA
 * annotations used to do for every save:
 * <ul>
 *   <li>{@code @GeneratedValue(IDENTITY)} — hand out the next numeric id from
 *       {@link com.freshmeat.repository.SequenceGenerator};</li>
 *   <li>{@code @PrePersist/@PreUpdate} — maintain {@code createdAt}/
 *       {@code updatedAt}.</li>
 * </ul>
 * Everything else (conversion, index creation, repositories) stays exactly as
 * Boot would have configured it: the same {@code MongoDatabaseFactory} and
 * {@code MongoConverter} beans are reused.
 */
@Configuration
public class MongoConfig {

    @Bean
    public MongoTemplate mongoTemplate(MongoDatabaseFactory databaseFactory,
                                       MongoConverter converter,
                                       MongoEntityLifecycle entityLifecycle) {
        MongoTemplate template = new MongoTemplate(databaseFactory, converter);
        template.setEntityCallbacks(EntityCallbacks.create(entityLifecycle));
        return template;
    }
}
