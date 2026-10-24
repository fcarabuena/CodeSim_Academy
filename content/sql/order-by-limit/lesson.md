---
title: ORDER BY and LIMIT
order: 2
difficulty: beginner
xp: 25
type: query
language: sql
summary: Sort your results and keep only the top rows.
hints:
  - "Sort with ORDER BY price DESC (DESC means biggest first)."
  - "LIMIT 3 keeps only the first three rows."
  - "The order of the clauses matters: SELECT ... FROM ... ORDER BY ... LIMIT ..."
---

Databases don't promise to return rows in any particular order. When order matters, you ask for it.

## ORDER BY

```sql
SELECT name, price
FROM products
ORDER BY price;
```

- `ORDER BY price` sorts from smallest to largest (**ascending**, or `ASC`). That's the default.
- `ORDER BY price DESC` sorts from largest to smallest (**descending**).
- Text sorts alphabetically: `ORDER BY name`.

You can sort by several columns. The second one breaks ties in the first:

```sql
SELECT name, category, price
FROM products
ORDER BY category, price DESC;
```

## LIMIT

`LIMIT` keeps only the first few rows. Together with `ORDER BY` it answers "top N" questions:

```sql
-- The 5 cheapest products
SELECT name, price
FROM products
ORDER BY price
LIMIT 5;
```

## Putting it together

Clauses always go in this order:

```sql
SELECT ...
FROM ...
WHERE ...      -- optional: filter rows first
ORDER BY ...   -- then sort them
LIMIT ...;     -- then keep the top few
```

## Your challenge

The shop wants to feature its **3 most expensive products**. Write a query that returns the `name`
and `price` of those three products, with the **most expensive first**.

This time the order of the rows matters!
