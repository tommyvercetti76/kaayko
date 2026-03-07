# Kamera Quest Frontend

## Scope

Kamera Quest is the photography guidance experience for camera selection, scene selection, and preset/session-brief output.

## Primary entrypoints

- `src/karma.html`
- `src/karma/kameras/index.html`

Supporting files:

- `src/karma/kameras/assets/kamera-enhancer.js`
- `src/karma/kameras/assets/kamera-enhancer.css`

## Backend routes consumed

- `GET /presets/meta`
- `GET /cameras/:brand`
- `GET /cameras/:brand/:modelName/lenses`
- `POST /presets/classic`
- `POST /presets/smart`

## UX responsibilities

- Gear selection
- Scene and condition selection
- Skill-level-aware output rendering
- Session playbook display and exposure exploration

## Quality notes

- This product depends heavily on frontend contract discipline because the backend output is intentionally structured by skill level.
- Any UI change should be tested against at least `Apprentice`, `Enthusiast`, and `Professional` result shapes.
- This is the cleanest candidate for contract snapshots because the backend already exposes stable metadata and smoke tests.
