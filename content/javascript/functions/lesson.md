---
title: Functions
order: 2
difficulty: beginner
xp: 25
type: function
language: javascript
summary: Package up code you can reuse, with inputs and a return value.
hints:
  - "The formula is: fahrenheit = celsius * 9 / 5 + 32"
  - "Use the return keyword to hand the answer back: return celsius * 9 / 5 + 32;"
  - "Don't use console.log for the answer: the tests check what the function returns."
---

A **function** is a reusable piece of code with a name. You give it some inputs, it does some
work, and it hands back a result.

## Declaring a function

```js
function double(number) {
  return number * 2;
}
```

- `double` is the function's **name**.
- `number` is a **parameter**: a variable that holds the input.
- `return` sends a value back to whoever called the function, and stops the function.

## Calling a function

```js
const result = double(21);
console.log(result);       // 42
console.log(double(5));    // 10
```

The values you pass in (`21`, `5`) are called **arguments**.

## More than one parameter

```js
function fullName(first, last) {
  return first + " " + last;
}

fullName("Ada", "Lovelace"); // "Ada Lovelace"
```

## return vs console.log

`console.log` only *shows* a value. `return` *gives it back* so other code can use it. A function
without `return` gives back `undefined`:

```js
function oops(n) {
  n * 2;            // calculated, then thrown away!
}
oops(4);            // undefined
```

## Your challenge

Write a function `celsiusToFahrenheit(celsius)` that **returns** the temperature in Fahrenheit.

The formula is: multiply by 9, divide by 5, then add 32. For example,
`celsiusToFahrenheit(100)` should return `212`.

You can call your function with `console.log` and press **Run** to try it out. The tests call it
with different temperatures when you press **Submit**.
