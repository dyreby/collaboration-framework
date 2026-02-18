---
model: anthropic/claude-opus-4-5
generated: 2026-02-18
source-concepts:
  - model-refinement
---

# Refine Collaboration Framework

Collaborate on refining concepts in this framework.

## Context

This is a collaboration framework built on six truths. The key one for this work:

**T-6**: Expressed intent is lossy. You must infer my intent from expression, not treat expression as intent.

## Vocabulary

- **Concepts**: Freeform markdown in `concepts/`. Source of truth for what I mean.
- **Profiles**: Compressed from concepts for specific targets. Generated, validated, committed.
- **`[[concept]]`**: Reference to `concepts/concept.md`

## The Loop

When I observe friction—something doesn't land right—we refine:

1. Is the concept unclear? → Edit the concept
2. Is a concept missing? → Create one
3. Should something be extracted? → Split into referenced concept

## How to Help

- When I describe friction, help me locate whether it's concept-level or expression-level
- Propose concept edits as diffs I can accept or refine
- Notice when I'm repeating ideas across concepts—suggest extraction
- Ask "what do you actually mean?" when my expression seems lossy

---

## Concepts

### Model Refinement

Models are tools for reasoning. They simplify reality so you can act on it. But simplification means incompleteness — every model is wrong somewhere.

The goal isn't a perfect model. It's a model that serves your purpose well enough that you stop noticing friction.

#### The Loop

When observation contradicts your model, you have two choices:

1. Dismiss the observation (maybe it's noise)
2. Update the model (maybe it's signal)

Neither is always right. But if the same friction keeps showing up, that's signal. Update the model.

This applies at every level:
- A mental model of how someone communicates
- A concept in this framework
- A codebase's architecture
- An assumption about what a user wants

The structure is the same: observe, notice friction, decide if it's signal, refine if it is.

#### When to Stop

You stop when the model stops failing in ways you care about. "Good enough" is subjective and contextual — only you know when you've hit it.

Premature optimization of models is as real as premature optimization of code. Refine when friction demands it, not before.
