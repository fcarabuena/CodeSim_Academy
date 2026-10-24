---
title: CSS selectors and colours
order: 3
difficulty: beginner
xp: 25
type: page
language: html
summary: Style elements, classes and ids with colours and fonts.
hints:
  - "CSS rules go inside the <style> tag in the <head>."
  - "Select by tag with h1 { ... }, by class with .highlight { ... } and by id with #intro { ... }."
  - "Hex colours start with #, for example color: #2563eb;"
  - "Bold text is font-weight: bold;"
---

HTML says *what* things are. **CSS** (Cascading Style Sheets) says how they *look*: colours, fonts,
sizes and spacing.

## A CSS rule

```css
h1 {
  color: tomato;
  font-size: 40px;
}
```

- `h1` is the **selector**: which elements the rule applies to.
- `color` and `font-size` are **properties**, and `tomato` and `40px` are their **values**.
- Every declaration ends with a semicolon `;`.

For now, put your CSS inside a `<style>` tag in the `<head>` of the page.

## Three kinds of selectors

```css
p { color: gray; }           /* every <p> on the page   */
.warning { color: red; }     /* elements with class="warning" */
#title { font-size: 48px; }  /* the one element with id="title" */
```

```html
<p class="warning">Mind the gap!</p>
<h1 id="title">Welcome</h1>
```

- A **class** (`.name`) can be used on as many elements as you like.
- An **id** (`#name`) should be used on only **one** element per page.

## Colours

You can write colours in several ways. These are all the same yellow:

```css
color: yellow;             /* a colour name     */
color: #ffff00;            /* hex: red, green, blue from 00 to ff */
color: rgb(255, 255, 0);   /* red, green, blue from 0 to 255       */
```

`color` changes the text colour and `background-color` changes the colour behind it.

## Your challenge

The page already has the HTML. Add CSS in the `<style>` tag so that:

1. the `<h1>` text colour is `#2563eb` (a bright blue),
2. elements with the class `highlight` have a `yellow` background colour,
3. the paragraph with the id `intro` is **bold** (`font-weight: bold`).

Don't change the HTML: only the CSS.
