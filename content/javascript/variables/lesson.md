---
title: Variables
order: 1
difficulty: beginner
xp: 20
type: function
language: javascript
summary: Store values in variables and print them with console.log.
hints:
  - "Use const for values that never change and let for values that do."
  - "To add one to a variable: score = score + 1;"
  - "console.log(a, b) prints a and b separated by a space."
---

A **variable** is a named box that holds a value. In JavaScript you create one with
`let` or `const`:

```js
const name = "Ada";   // a string (text) in quotes
let age = 36;         // a number
```

- Use **`const`** when the value will never change.
- Use **`let`** when you will change it later:

```js
let score = 0;
score = score + 10;   // score is now 10
```

## Printing

`console.log` prints a value to the output panel:

```js
console.log(name);              // Ada
console.log("Age:", age);       // Age: 36
console.log(name + " rocks!");  // Ada rocks!
```

Joining strings with `+` is called **concatenation**. You can also use a **template
string** with backticks and `${}`:

```js
console.log(`${name} is ${age} years old`); // Ada is 36 years old
```

## Your challenge

1. Create a `const` called `city` holding the text `"Tokyo"`.
2. Create a `let` called `visitors` holding the number `5`.
3. Increase `visitors` by `1`.
4. Print exactly this line: `Tokyo has 6 visitors`

Use your variables to build the line: don't just type the words!
