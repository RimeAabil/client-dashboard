# Task 2: Debugging & System Thinking

## 1. Root causes

### Race conditions in the update flow

A race condition happens when two operations that touch the same data run close together in time, and the outcome depends on which one happens to finish first — instead of which one was *supposed* to happen first.

In this app, clicking "Next Status" triggers two separate network calls: a `PUT` to update the status, followed by a `GET` to refresh the whole list. These are two independent requests, and nothing guarantees they resolve in the order they were sent. If a user clicks the button twice, or if one request is delayed by the network, an older response can arrive *after* a newer one and silently overwrite it in the frontend's state. That's what produces both symptoms described: updates that don't reflect immediately (the screen is still waiting on/showing the result of an earlier request) and the API appearing to return outdated data (it's not — the frontend is just applying responses out of order).

### No real-time sync between clients

The dashboard only pulls fresh data on mount and after an action *you* trigger. There's no mechanism — WebSocket, SSE, polling — that pushes updates to other open tabs or other users. So if two people are looking at the dashboard, one person's status change is invisible to the other until they manually reload. This looks like a sync bug but it's really a missing feature: the app was never designed to sync, only to fetch-once-per-action.

### Performance degradation from unbounded queries and SQLite's write model

`GET /requests` runs `SELECT * FROM requests` with no pagination, no filtering, and no indexes beyond the primary key. As the table grows, every fetch pulls and serializes the entire dataset, so response time grows linearly with row count. On top of that, SQLite allows only one writer at a time — under concurrent status updates, writes start queuing, which compounds the slowdown as usage grows.

## 2. How I'd debug it, step by step

1. **Reproduce with the Network tab open.** Click the status button rapidly and watch request/response order and timing — this is usually enough to visually confirm a race condition, since you can literally see an older response land after a newer one.
2. **Compare frontend state against the actual database.** Query `database.db` directly (via the `sqlite3` CLI) immediately after an update to check whether the correct value is already persisted. If the DB is right but the screen is wrong, the bug is in how the frontend applies responses, not in the backend logic.
3. **Test with request cancellation disabled vs. enabled**, and try artificially throttling the network in dev tools — race conditions are timing-dependent, so they're easier to trigger and confirm under a slow or inconsistent connection.
4. **Open two tabs, update in one, watch the other.** This isolates the missing real-time sync issue from the race condition issue — they produce similar symptoms but have different root causes and different fixes.
5. **Seed the database with a large volume of rows (tens of thousands)** and benchmark `GET /requests` response time, then run `EXPLAIN QUERY PLAN` on the query to confirm whether it's doing a full table scan versus using an index — this isolates the scale issue from the sync issues above.



## 3. How I'd fix it

**Optimistic updates**

Right now the flow is: click → send request → wait → response comes back → *then* update the screen. The "wait" is where the lag comes from, even if the server is fast — there's still a round trip.

An optimistic update flips this: the moment you click "Next Status," you update the row in React state *immediately*, based on what you expect the server to do (New → In Progress). The UI changes instantly. The request still goes out in the background. If it succeeds, nothing else happens — the state you already set matches what the server confirms. If it fails, you revert that row back to its previous status and probably show an error.

```js
const updateStatus = async (id, currentStatus) => {
  const next = NEXT_STATUS[currentStatus];
  
  // update UI immediately
  setRequests(prev => prev.map(r => r.id === id ? { ...r, status: next } : r));

  try {
    await API.put(`/requests/${id}`, { status: next });
  } catch (err) {
    // roll back if it failed
    setRequests(prev => prev.map(r => r.id === id ? { ...r, status: currentStatus } : r));
  }
};
```

This doesn't fix the race condition itself — it fixes the *perceived* lag, which was one of the two reported symptoms.

**Cancel in-flight requests (`AbortController`)**

This is the one that actually targets the race condition. Here's the mechanism: every time `fetchRequests()` runs, it creates a new `AbortController` and passes its signal into the request. Before firing a new fetch, you call `.abort()` on the *previous* controller, if one is still pending.

```js
let currentController = null;

const fetchRequests = async () => {
  if (currentController) currentController.abort(); // cancel the old one
  currentController = new AbortController();

  const res = await API.get("/requests", { signal: currentController.signal });
  setRequests(res.data);
};
```

Concretely: if you click twice fast, the first `GET` gets cancelled the instant the second one starts. A cancelled request never resolves with a `.then()` — it throws an abort error instead, which you just ignore. So there's no longer a scenario where an old response "wins" and overwrites a new one, because old requests can't complete at all. That's the difference between this and optimistic updates — optimistic updates hide the symptom, this removes the actual mechanism that causes stale overwrites.

**Disable the action per-row while pending**

Right now, nothing stops you from clicking "Next Status" on the same row five times in one second, which fires five separate `PUT` requests, each trying to advance the status one more step than it should. You'd track a `pendingIds` set in state — add the row's `id` when a request starts, remove it when it finishes — and disable the button for any row currently in that set.

```js
const [pendingIds, setPendingIds] = useState(new Set());

const updateStatus = async (id, status) => {
  setPendingIds(prev => new Set(prev).add(id));
  await API.put(`/requests/${id}`, { status });
  setPendingIds(prev => { const s = new Set(prev); s.delete(id); return s; });
  refresh();
};

// in the table:
<button disabled={pendingIds.has(r.id)} onClick={...}>Next Status</button>
```

This is a simpler, cheaper safeguard than `AbortController` — it prevents the *duplicate* request from ever being sent, rather than cancelling it after the fact. Both are worth having; they cover slightly different cases (double-click vs. slow network + refetch race).

**Indexes + pagination**

An index is a separate data structure the database maintains alongside a table, so it can look up rows matching a condition (like `status = 'New'`) without scanning every row. Without an index on `status`, `WHERE status = 'New'` forces SQLite to check every single row in the table, one by one — that's an O(n) scan. With an index, it's closer to O(log n), since the index is sorted and searchable.

```sql
CREATE INDEX idx_requests_status ON requests(status);
CREATE INDEX idx_requests_created_at ON requests(created_at);
```

Pagination is a separate but related fix: right now `GET /requests` returns *every row, every time* — with 50 requests that's fine, with 500,000 it means shipping a huge JSON payload over the network on every single dashboard load. Pagination means the backend only returns a slice:

```sql
SELECT * FROM requests ORDER BY created_at DESC LIMIT 20 OFFSET 0;
```

and the frontend asks for the next page only when needed (e.g. "Load more" or infinite scroll). The index makes the query itself fast; pagination makes the payload size stay constant regardless of table size. You need both — an index without pagination is still shipping the whole table, just faster.

**No-cache headers**

By default, HTTP `GET` responses are sometimes cacheable by browsers or intermediate proxies, unless the server explicitly says not to. If any caching layer between your API and the frontend decides to cache a `GET /requests` response, subsequent requests could be served that cached copy instead of hitting your server at all — meaning the frontend gets old data even though the database is already updated.

```js
res.set("Cache-Control", "no-store");
res.status(200).json(rows);
```

This tells every layer in between — browser, proxy, CDN — "don't cache this, always go back to the source." It's a small, defensive fix, but for a dashboard showing live status, silent caching is exactly the kind of bug that's hard to catch because it looks identical to a race condition, except it has nothing to do with request timing.

## Redesign for scale

**React Query / SWR**

These libraries replace the pattern of "manually call `fetchRequests()` after every action" with a declarative one: you describe *what* data a component needs (`useQuery(['requests'], fetchRequests)`), and the library handles *when* to actually fetch it — on mount, on window refocus, on an interval, or when you tell it a specific piece of data is now "stale" after a mutation.

The relevant part for your bugs: these libraries track requests by a key (like `'requests'`) and automatically drop/ignore outdated responses if a newer request for the same key has already started — which is the same problem `AbortController` solves, but handled for you consistently across the whole app instead of something you have to hand-roll in every component.

**Real-time layer (WebSockets/SSE)**

A normal `GET` request is pull-based — the client has to ask "anything new?" A WebSocket is a persistent, two-way connection: the server can push a message to the client the moment something changes, without the client asking. So the flow becomes: user A updates a status → backend saves it → backend broadcasts `{ id, newStatus }` to every connected client → user B's dashboard updates without B doing anything. This is the only real fix for "two people looking at the dashboard don't see each other's changes" — polling can approximate it, but it's always a delay of "however often you poll," where a WebSocket push is near-instant.

**PostgreSQL over SQLite**

This is a structural limitation, not a tuning issue: SQLite locks the entire database file for the duration of a write, so if two `PUT` requests try to write at the same moment, one physically has to wait for the other to finish, no matter how fast your code is. Postgres uses row-level locking and a proper multi-version concurrency model (MVCC), meaning two writes to *different rows* don't block each other at all, and even writes to the same row are handled far more gracefully. Connection pooling on top of that means many simultaneous requests can share a small number of actual database connections efficiently, instead of each request opening its own.

**Redis caching with explicit invalidation**

The difference between this and the "no-cache headers" fix above: no-cache headers *prevent* passive caching from happening. Redis is the opposite — it's an *intentional* cache you control. For data that's read far more often than it's written (say, a count of open requests shown on a summary widget), you'd store the computed result in Redis. The key part is "explicit invalidation": the moment a write happens that would change that result, your code actively deletes or updates that Redis key — so the cache is never serving something you know is wrong, unlike a browser cache that just expires on a timer regardless of whether the data actually changed.

**Server-side pagination/filtering + observability**

Same pagination concept as above, but done consistently as a redesign principle rather than a patch. Observability means instrumenting the app to answer "is this slow, and where" *before* a user tells you — e.g., logging how long each database query takes, counting error rates per endpoint, and setting up an alert if `GET /requests` p95 latency crosses some threshold. Without this, "the system is slow" is something you find out from complaints; with it, you'd see the query time creeping up in a dashboard as the table grows, long before it becomes a user-facing problem.