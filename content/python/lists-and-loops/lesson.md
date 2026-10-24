---
title: Lists and loops
order: 3
difficulty: intermediate
xp: 30
type: function
language: python
summary: Store values in lists and process them with for loops.
hints:
  - "Keep track of the best word so far: longest = \"\" before the loop."
  - "Loop with for word in words:"
  - "len(word) gives the number of letters in a word."
  - "Use > (not >=) so that, when two words tie, the first one wins."
---

A **list** stores several values in order, inside square brackets:

```python
fruits = ["apple", "banana", "cherry"]
scores = [12, 7, 30]
```

## Working with lists

```python
fruits[0]              # "apple"  (counting starts at 0!)
len(fruits)            # 3
fruits.append("kiwi")  # adds "kiwi" to the end
```

`len` also works on text: `len("banana")` is `6`.

## for loops

A `for` loop runs its indented body once for every item in the list:

```python
for fruit in fruits:
    print(f"I like {fruit}")
```

## Keeping track of the best so far

A common pattern is to remember the "best" item while you loop:

```python
def biggest(numbers):
    best = numbers[0]
    for n in numbers:
        if n > best:
            best = n
    return best

print(biggest([4, 19, 7]))   # 19
```

`if` runs its indented block only when the condition is true. Comparisons include `>`, `<`, `>=`,
`<=`, `==` (equal) and `!=` (not equal).

## Your challenge

Write a function `longest_word(words)` that returns the **longest** word in a list.

- `longest_word(["cat", "giraffe", "dog"])` returns `"giraffe"`.
- If two words are equally long, return the one that comes **first**.
- If the list is empty, return an empty string `""`.
