# ADR-03: Foundation Revision

- **Status:** Accepted
- **Date:** 2026-02-15
- **RFC:** [RFC-03](../rfcs/rfc-03-foundation-revision.md)
- **Supersedes:** ADR-01 (Truths content, not structure)

## Context

RFC-01 established four Truths as the Foundation. Through analysis, we found:

1. **T-1 (Agent Definition)** is definitional, not structural — moved to presuppositions
2. **T-2 (Action Consequence)** is obvious from physics — LLMs already presuppose this
3. **T-3 (Input Duality)** used unclear language — "input" and "inference" needed disambiguation
4. **T-4 (Model Fallibility)** covered only fallibility — missing incomplete and mutable

We also lacked an explicit claim about *why* agents act (objectives), which is necessary to derive principles about "better" and "worse" outcomes.

## Decision

Revise the Foundation to three Truths, grounded in documented presuppositions.

### Presuppositions (Not Encoded)

| # | Premise |
|---|---------|
| P-0 | Something exists |
| P-1 | Duality (distinct things exist) |
| P-2 | Physical determinism (consistent physics at macro scale) |
| P-3 | Agent/world distinction |
| P-4 | Agent definition (entity capable of acting in the world) |

### Revised Truths (Encoded)

**T-1: Objective-Driven Action**
Agents act from internal objectives.

**T-2: World Model**
Agents have internal world models that are incomplete, fallible, and mutable.

**T-3: Input Distinction**
World input and model-derived conclusions are distinct. World input is taken as given.

### Migration from RFC-01

| RFC-01 | RFC-03 | Rationale |
|--------|--------|-----------|
| T-1: Agent Definition | → P-4 | Definitional, not structural |
| T-2: Action Consequence | Removed | Obvious from physics |
| T-3: Input Duality | → T-3: Input Distinction | Clearer language |
| T-4: Model Fallibility | → T-2: World Model | Combined with incomplete, mutable |
| — | T-1: Objectives | New; enables "better/worse" reasoning |

## Consequences

- Framework version increments to v0.2.0
- Foundation encoded as three Truths: T-1, T-2, T-3
- Presuppositions (P-0 through P-4) documented but not encoded in agent context
- ADR-01 remains as historical record; this ADR captures current state
- Principles can now derive from explicit objective grounding
