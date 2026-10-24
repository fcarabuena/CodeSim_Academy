---
title: Print and variables
order: 1
difficulty: beginner
xp: 20
type: function
language: python
summary: Print messages and keep values in variables.
hints:
  - "Strings need quotes: \"Hello\". Numbers don't: 7."
  - "An f-string puts variables inside text: f\"Hi {name}\"."
  - "To double a number: total = total * 2"
---

Python is famous for being easy to read. Your very first tool is `print`, which shows a
value in the output panel:

```python
print("Hello, world!")
print(7)
```

## Variables

A **variable** is a name for a value. Create one with `=`:

```python
name = "Ada"     # a string (text) in quotes
age = 36         # a whole number (an int)
```

You can change a variable by assigning it again:

```python
age = age + 1    # age is now 37
```

## Printing variables

Give `print` several values separated by commas and it puts spaces between them:

```python
print(name, "is", age)     # Ada is 37
```

Or use an **f-string**: put an `f` before the quotes and variables in `{}`:

```python
print(f"{name} is {age} years old")   # Ada is 37 years old
```

## Your challenge

1. Create a variable `animal` holding the text `"cat"`.
2. Create a variable `lives` holding the number `9`.
3. Print `Hello, Python!` on the first line.
4. Print `A cat has 9 lives` on the second line, built from your variables.
