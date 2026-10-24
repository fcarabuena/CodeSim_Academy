---
title: Your first web page
order: 1
difficulty: beginner
xp: 20
type: page
language: html
summary: Learn the skeleton every HTML page shares.
hints:
  - "The page title goes inside <title>, which lives inside <head>."
  - "Headings use <h1> for the most important one. Paragraphs use <p>."
  - "Add the language to the opening tag like this: <html lang=\"en\">."
---

Every web page you have ever visited is built from **HTML** (HyperText Markup Language).
HTML describes *what* things are: this is a heading, this is a paragraph, this is a link.

## Tags

HTML is made of **tags** written in angle brackets. Most come in pairs: an opening tag and a
closing tag with a `/`.

```html
<p>This is a paragraph.</p>
```

## The page skeleton

Every page shares the same basic structure:

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <title>My page</title>
  </head>
  <body>
    <h1>Hello!</h1>
    <p>Welcome to my page.</p>
  </body>
</html>
```

- `<!DOCTYPE html>` tells the browser this is a modern HTML page.
- `<html lang="en">` wraps everything. `lang` says which language the page is written in,
  which helps screen readers and search engines.
- `<head>` holds information *about* the page, like its `<title>` (shown in the browser tab).
- `<body>` holds everything you see on the page.

## Your challenge

Finish the page in the editor so that it has:

1. a `lang` attribute on the `<html>` tag,
2. a `<title>` in the head,
3. one `<h1>` heading in the body,
4. at least **two** `<p>` paragraphs about yourself or a hobby.

Press **Run** to see your page in the preview, then **Submit** when you are happy with it.
