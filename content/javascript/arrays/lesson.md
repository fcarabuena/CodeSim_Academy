---
title: Arrays and loops
order: 3
difficulty: intermediate
xp: 30
type: function
language: javascript
summary: Store lists of values in arrays and loop over them.
hints:
  - "Start with let total = 0; before the loop."
  - "Loop with for (const n of numbers) { ... }"
  - "A number is even when n % 2 === 0 (the remainder after dividing by 2 is zero)."
  - "Return total after the loop has finished, not inside it."
---

An **array** is an ordered list of values, written in square brackets:

```js
const scores = [12, 7, 30];
const names = ["Ada", "Grace", "Linus"];
```

## Reading and changing arrays

```js
scores[0];          // 12   (counting starts at 0!)
scores.length;      // 3
scores.push(25);    // adds 25 to the end: [12, 7, 30, 25]
```

## Looping over an array

A `for...of` loop runs once for every item:

```js
for (const name of names) {
  console.log("Hello, " + name);
}
```

## Adding things up

A common pattern is to keep a running total:

```js
function sum(numbers) {
  let total = 0;
  for (const n of numbers) {
    total = total + n;
  }
  return total;
}

sum([1, 2, 3]); // 6
```

## Checking with if

`%` gives the **remainder** after dividing. A number is even when the remainder after dividing by
2 is zero:

```js
10 % 2;  // 0  -> even
7 % 2;   // 1  -> odd

if (n % 2 === 0) {
  // n is even
}
```

## Your challenge

Write a function `sumOfEvens(numbers)` that returns the sum of only the **even** numbers in the
array. For example, `sumOfEvens([1, 2, 3, 4])` returns `6` (2 + 4).

If there are no even numbers (or the array is empty), it should return `0`.
