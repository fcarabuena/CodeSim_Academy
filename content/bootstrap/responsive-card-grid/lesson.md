---
title: A responsive card grid
order: 1
difficulty: beginner
xp: 30
type: page
language: html
summary: Lay out cards that stack on phones and sit side by side on laptops.
hints:
  - "The structure is .container > .row > columns > .card."
  - "Give each column the classes col-12 col-md-4 so there are three per row on medium screens."
  - "Inside each card use a .card-body containing a .card-title, a .card-text and an a.btn."
---

**Bootstrap** is a free CSS framework. Instead of writing your own CSS, you add ready-made
**classes** to your HTML. The preview already loads Bootstrap for you with this line in the head:

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css">
```

## The grid

Bootstrap's grid splits each row into **12 equal parts**. A column says how many parts it uses:

```html
<div class="container">
  <div class="row">
    <div class="col-12 col-md-4">One</div>
    <div class="col-12 col-md-4">Two</div>
    <div class="col-12 col-md-4">Three</div>
  </div>
</div>
```

- `col-12` means "use all 12 parts" (full width) on small screens such as phones.
- `col-md-4` means "use 4 of 12 parts" (a third) on **m**edium screens and wider.

So on a phone the columns stack, and on a laptop they sit three across. That is
**responsive design**.

## Cards

A card is a box with a border and padding:

```html
<div class="card">
  <div class="card-body">
    <h5 class="card-title">Card title</h5>
    <p class="card-text">Some text about this card.</p>
    <a href="#" class="btn btn-primary">Read more</a>
  </div>
</div>
```

## Your challenge

Build a grid of **three cards** inside a `.container` and a `.row`:

- each card sits in a column with the classes `col-12 col-md-4`,
- each card has a `.card-body` with a `.card-title`, a `.card-text` and a button (`.btn`).

Try making the preview narrower and wider to watch the cards rearrange.
