# FreshMeat

A meat-delivery store split into two independently runnable projects:

| Folder      | Stack                                   | Port | Run                          |
|-------------|-----------------------------------------|------|------------------------------|
| `backend/`  | Spring Boot 3 (Java, Maven, MySQL, JWT) | 8082 | `mvn spring-boot:run`        |
| `frontend/` | React 18 + Vite 5 (`react-router-dom`)  | 5173 | `npm install && npm run dev` |

The frontend is a single-page app that talks to the backend **only** through
`VITE_API_BASE_URL` (see `frontend/.env`); no backend URL is hardcoded in any
component. The backend allows browser requests from the Vite dev origin via
`app.cors.allowed-origins`.

## Backend

```bash
cd backend
mvn spring-boot:run            # http://localhost:8082
# or build a jar:
mvn clean package              # target/freshmeat-1.0.0.jar
java -jar target/freshmeat-1.0.0.jar
```

Configuration lives in `backend/src/main/resources/application.properties`
(DB, JWT secret, upload path, CORS origins). Overridable via environment
variables: `PORT`, `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USERNAME`, `DB_PASSWORD`.

Seeded accounts: delivery `ravi@freshmeat.com` / `delivery123`.
Admin account must be created securely via one-time setup.

## Frontend

```bash
cd frontend
npm install
npm run dev                    # http://localhost:5173
npm run build                  # production build into dist/
```

Copy `frontend/.env.example` to `frontend/.env` and set `VITE_API_BASE_URL`
to the backend (defaults to `http://localhost:8082`). Secrets stay in the
backend only.

## Notes

- The pre-split project is preserved in `_backup_original/` (and the
  `original-project-v1` git tag) and is intentionally git-ignored.
