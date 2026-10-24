---
title: Functions
order: 2
difficulty: beginner
xp: 25
type: function
language: python
summary: Write reusable functions with def and return.
hints:
  - "Start with def greet(name): and indent the next line by 4 spaces."
  - "An f-string builds the text: f\"Hello, {name}!\""
  - "Use return, not print: the tests check what your function gives back."
---

A **function** is a named, reusable block of code. You give it inputs, and it gives back a result.

## Defining a function

```python
def double(number):
    return number * 2
```

- `def` starts a function definition, followed by its **name** and its **parameters** in brackets.
- The line ends with a colon `:`.
- The body is **indented** (4 spaces). Python uses indentation to know what belongs to the function.
- `return` hands a value back and ends the function.

## Calling a function

```python
result = double(21)
print(result)        # 42
print(double(5))     # 10
```

## Building text

f-strings (from the first lesson) are perfect for building text inside a function:

```python
def describe(animal, legs):
    return f"A {animal} has {legs} legs"

print(describe("spider", 8))   # A spider has 8 legs
```

## return vs print

`print` only *shows* a value. `return` *gives it back* so other code can use it. A function that
never returns anything gives back `None`:

```python
def oops(name):
    print(f"Hi {name}")    # shows it, but returns None
```

## Your challenge

Write a function `greet(name)` that **returns** a greeting like `Hello, Ada!`: the word `Hello`, a
comma and a space, the name, then an exclamation mark.

Try it with `print(greet("Ada"))` and **Run**. When you **Submit**, the tests call `greet` with
other names.
