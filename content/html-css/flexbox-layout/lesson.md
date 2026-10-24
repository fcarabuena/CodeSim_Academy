---
title: Flexbox layout
order: 4
difficulty: intermediate
xp: 30
type: page
language: html
summary: Put elements side by side and space them out with flexbox.
hints:
  - "Flexbox is switched on by the parent: .menu { display: flex; }"
  - "justify-content: space-between; pushes the first and last items to the edges."
  - "gap: 16px; adds space between flex items."
  - "flex-wrap: wrap; lets items move onto a new line when there isn't room."
---

By default, block elements like `<div>` and `<p>` stack on top of each other. To put them **side
by side** you use **flexbox**, the most useful layout tool in CSS.

## Turning flexbox on

Flexbox is set on the **parent** (the container). Its children then line up in a row:

```css
.row {
  display: flex;
}
```

```html
<div class="row">
  <div>One</div>
  <div>Two</div>
  <div>Three</div>
</div>
```

## Spacing things out

```css
.row {
  display: flex;
  justify-content: space-between; /* how items share the row */
  align-items: center;            /* line items up vertically */
  gap: 16px;                      /* space between items      */
}
```

Useful values for `justify-content`:

| Value | What it does |
| --- | --- |
| `flex-start` | items bunch up at the start (the default) |
| `center` | items bunch up in the middle |
| `space-between` | first item at the start, last at the end, equal space between |

## Wrapping onto new lines

On a narrow screen a row of cards can get squashed. `flex-wrap: wrap` lets items move onto the
next line instead:

```css
.cards {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
}
```

## Your challenge

The page has a navigation menu and some cards. Add CSS so that:

1. `.menu` uses flexbox with `justify-content: space-between`,
2. `.cards` uses flexbox, wraps onto new lines (`flex-wrap: wrap`) and has a `gap` of `16px`.

Press **Run** and drag the edge of the preview narrower to watch the cards wrap.
