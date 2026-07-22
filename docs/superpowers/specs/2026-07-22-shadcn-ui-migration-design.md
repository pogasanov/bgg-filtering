# Shadcn UI Migration Design

## Goal

Replace the application's hand-written and native interface controls with current official shadcn/ui components while preserving all existing BoardGameGeek sync, filtering, sorting, and result behavior.

## Scope

- Configure the existing Next.js and Tailwind CSS v4 application for the current shadcn/ui release.
- Use the `new-york` component style and shadcn's standard neutral light theme expressed through the current OKLCH design tokens.
- Replace the existing locally simplified UI implementations and native controls used by `BggApp` with generated shadcn components.
- Preserve the current responsive page structure, information hierarchy, content, and all in-progress filtering features.
- Keep application data types, API routes, cache behavior, and filtering semantics unchanged.

Dark-mode switching, a new information architecture, and unrelated refactoring are outside this migration.

## Component Architecture

The shadcn CLI remains the source of the low-level UI component files under `components/ui`. The application composes those local components directly; it does not add another wrapper layer.

The migration uses these official components:

- `Button`, `Badge`, `Card`, and `Input` for their current equivalents.
- `Label` and `Field`-appropriate accessible labeling for form controls.
- `Select` for sorting and translation-language selection.
- `Checkbox` for category and mechanic selection.
- `Slider` with two thumbs for the minimum and maximum publication year.
- `Table` for the player recommendation matrix.
- `Alert` for synchronization errors and empty-cache guidance.
- `ScrollArea` for the long category and mechanic list.
- `Separator` for structural divisions where appropriate.

Application-specific composition stays in `components/bgg-app.tsx`. Generated component files should remain close to upstream shadcn output and should not contain application-specific colors or behavior.

## Styling

`app/globals.css` will use the current Tailwind v4 shadcn imports, theme mapping, and default neutral OKLCH variables. The existing bespoke cream, teal, and red palette and the custom range-input CSS will be removed.

Layout styling remains in Tailwind utility classes at the composition layer. The page keeps its two-column desktop layout, stacked mobile layout, filter sidebar, recommendation matrix, and result cards. Default shadcn spacing, borders, focus states, and typography replace the custom visual treatment.

## Behavior and Data Flow

State remains owned by `BggApp`. Component events update the same React state values already used by `filterGames`; no filtering or synchronization logic moves into the shadcn components.

The two-thumb year slider maps its lower and upper values to the existing nullable `minYear` and `maxYear` state. Slider endpoints continue to represent an open minimum or maximum, preserving the current `No min` and `No max` behavior.

The recommendation matrix continues to toggle the same `MatrixSelection` values. Select and checkbox components adapt their shadcn event APIs to the existing sort, language, and tag state without changing filter semantics.

## Error and Empty States

Synchronization failures use the destructive `Alert` treatment and retain the current server-provided fallback message. The empty-cache guidance uses an `Alert` or `Card` composition consistent with the rest of the page. Disabled and pending states remain visible and accessible, including the spinning sync icon and disabled sync button.

## Accessibility

Every control retains an accessible label. Selects and checkboxes use the keyboard and focus behavior supplied by their official primitives. The slider exposes both minimum and maximum values, and matrix buttons continue to convey selected state in visible text. Focus rings and disabled states use the default shadcn theme.

## Testing and Verification

Tests will be written or updated before each behavior-affecting migration step. They will cover the rendered shadcn control structure and the existing state-to-filter interactions without coupling to incidental class names.

Completion requires:

- the focused UI tests to pass;
- the full Vitest suite to pass;
- TypeScript typechecking to pass;
- a production Next.js build to pass; and
- a final diff review confirming that unrelated working-tree changes were preserved.

