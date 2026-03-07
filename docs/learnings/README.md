# Learnings of Kaayko

This directory is the target for product-by-product learning notes generated after meaningful changes and for structured outputs consumed by the `Learnings of Kaayko` automation.

## Recommended structure

```text
docs/learnings/
├── store/
├── paddling-out/
├── kortex/
├── kreator/
├── kamera-quest/
└── shared/
```

## Recommended file naming

Use one markdown note per product update:

```text
docs/learnings/<product>/<YYYY-MM-DD>-summary.md
```

Each product directory should also maintain:

```text
docs/learnings/<product>/latest.json
```

This file is the machine-readable handoff between product guards and the learnings aggregator.

## Minimum note contents

1. Scope of the change
2. Frontend files touched
3. Backend routes or files affected
4. Evidence and validation performed
5. Security, debt, or UX concerns discovered
6. Next actions

## Portfolio synthesis

`Learnings of Kaayko` should also write a dated portfolio-level synthesis under:

```text
docs/learnings/shared/<YYYY-MM-DD>-portfolio-summary.md
```

That summary should highlight:

1. Cross-product recurring failures
2. Security trends
3. UX and debt trends
4. Highest-leverage next steps
