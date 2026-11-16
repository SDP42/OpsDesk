# API examples

All endpoints live under `/api` and return `{ "data": ... }` envelopes. Sign in first; the session is an httpOnly cookie, so `curl` keeps it in a cookie jar. The demo password comes from `DEMO_PASSWORD` in your `.env`.

```bash
curl -c jar -H 'content-type: application/json' \
  -d '{"email":"priya.nair@opsdesk.demo","password":"'$DEMO_PASSWORD'"}' \
  http://localhost:3000/api/auth/login
```

## List my queue

```bash
curl -b jar 'http://localhost:3000/api/tickets?view=mine&limit=20'
```

## File a flight

```bash
curl -b jar -H 'content-type: application/json' \
  -d '{"title":"Refund for TBOH-88213 still not received","tboh":"TBOH-88213","priority":"P3"}' \
  http://localhost:3000/api/tickets
```

## Suggest an intent

```bash
curl -b jar -H 'content-type: application/json' \
  -d '{"text":"refund still pending for cancelled booking"}' \
  http://localhost:3000/api/intents/suggest
```

## Escalate with a reason

```bash
curl -b jar -H 'content-type: application/json' \
  -d '{"reason":"Guest checks in tonight, supplier silent"}' \
  http://localhost:3000/api/tickets/<ticket_id>/escalate
```

## Breach forecast for a flight

```bash
curl -b jar http://localhost:3000/api/tickets/<ticket_id>/forecast
```

## Themes this week

```bash
curl -b jar http://localhost:3000/api/insights/themes
```

## Stream every ticket as CSV

```bash
curl -b jar -o tickets.csv 'http://localhost:3000/api/export/tickets?format=csv'
```

## Live updates over SSE

```bash
curl -N -b jar http://localhost:3000/api/stream
```
