# auth

Mock login (`POST /auth/login`) and the session used by every other feature.

## Token storage

- The session (`{ token, userId }`) lives in memory in `lib/session-store.ts` and is exposed through `AuthProvider` / `useAuth`.
- A copy is kept in `sessionStorage` so a page reload in the same tab stays signed in; it is gone when the tab closes.
- The token cannot be an `httpOnly` cookie here: the API contract returns it in the response body and the SSE endpoint takes it as `?token=` because `EventSource` cannot send headers.
- The token is never logged. The backend strips the query string from its request logs.
- A `401` from any call clears the session and sends the user to `/login?next=<current page>`.
