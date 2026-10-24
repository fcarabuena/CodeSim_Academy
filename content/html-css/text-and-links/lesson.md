---
title: Text, lists and links
order: 2
difficulty: beginner
xp: 20
type: page
language: html
summary: Organise text with headings and lists, and link to other pages.
hints:
  - "A smaller heading under your <h1> is an <h2>."
  - "Wrap the important words inside your paragraph in <strong>...</strong>."
  - "A link looks like <a href=\"https://developer.mozilla.org\">MDN Web Docs</a>."
  - "A bulleted list is a <ul> with one <li> per item."
---

Real pages have more than one heading and paragraph. HTML gives you tags to show how text is
organised, so readers (and screen readers) can find their way around.

## Headings

There are six levels of heading, from `<h1>` (most important) to `<h6>`. Use one `<h1>` for the
page title and `<h2>` for each section:

```html
<h1>My hobbies</h1>
<h2>Photography</h2>
<p>I take photos of birds.</p>
```

## Making words stand out

```html
<p>Always <strong>save your work</strong> before you <em>close</em> the editor.</p>
```

- `<strong>` marks important text (shown in **bold**).
- `<em>` adds emphasis (shown in *italics*).

## Lists

An **unordered** list shows bullet points. Each item is an `<li>` (list item):

```html
<ul>
  <li>Camera</li>
  <li>Tripod</li>
  <li>Spare battery</li>
</ul>
```

Use `<ol>` instead of `<ul>` for a **numbered** list, such as steps in a recipe.

## Links

The `<a>` tag (for "anchor") makes a link. The `href` attribute says where it goes:

```html
<a href="https://www.wikipedia.org">Visit Wikipedia</a>
```

The text between the tags is what people click, so make it describe where the link goes.
"Read the MDN guide" is much more helpful than "click here".

## Your challenge

Turn the page in the editor into a short guide about learning to code. It needs:

1. an `<h2>` section heading under the `<h1>`,
2. a paragraph with some **important words** wrapped in `<strong>`,
3. a link to `https://developer.mozilla.org` with descriptive text,
4. a bulleted list (`<ul>`) with at least **three** items.
