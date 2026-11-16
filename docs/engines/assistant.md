# Tower Radio: the voice assistant

**Module:** `apps/api/app/engines/assistant.py` · pure (no database, no HTTP) · typed Pydantic in, typed Pydantic out

## What it does

A persona-aware assistant that answers questions in plain English, by voice or text.

## How it works

The question is mapped to an intent plus filters with lexicons (regions, SLA words, persona help, a small knowledge base). The service layer runs the plan against the database and composes the reply; the browser's Web Speech API handles voice in and out. No paid API; an optional LLM can rephrase answers later.

## Inputs and outputs

| In | Out |
| --- | --- |
| Question text and the user's role | `AssistantPlan`: intent, filters, reason |

## Why it matters

Ops floors are busy. Asking "what is breaching in the UK?" out loud is faster than navigating screens.

[← All engines](README.md)
