# Styles

Every page and component keeps its styles in a CSS file here, imported at the end of its frontmatter imports. There are no `<style>` blocks or inline `style=""` attributes, except for values computed at runtime (for example `--pdo-size`).

- `global.css`: tokens (colors, type, spacing) and base elements. It sits in `@layer base`, so page and component rules win ties whatever order the build emits the files in.
- `layout.css`: the site header and footer (`Base.astro`).
- `pages/<name>.css`: one file per page. `Base` gets `page="<name>"` and sets `body.pg-<name>`.
- `components/<name>.css`: one file per component. The component's root element(s) carry `c-<name>`.

## Scoping (what Astro's scoped `<style>` used to do)

Each rule's last compound selector gets a zero-specificity `:where()` wrapper:

- Page rules use `:where(.pg-<name> > .wrap *):not(:where(.c, .c *))`. They apply to the page's own markup, not the site wrapper, and not inside components. Component roots carry the marker class `c`, except components that take a `<slot>` (case `Section`, `Callout`, `Options`, `Option`), because the page styles what goes in the slot.
- Component rules use `:where(.c-<name>, .c-<name> *)`.

Keyframes are global, so give them distinct names. Rules for elements a script creates (toasts, gift card, flying drops) are global: `components/ink-layer.css`.
