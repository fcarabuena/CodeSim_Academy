---
title: SELECT and WHERE
order: 1
difficulty: beginner
xp: 25
type: query
language: sql
summary: Pick columns from a table and filter the rows you want.
hints:
  - "Start with SELECT name, price FROM products"
  - "Text values need single quotes: category = 'Electronics'"
  - "Combine two conditions with AND."
---

A database stores data in **tables**, like spreadsheets. Our online shop has four tables:
`customers`, `products`, `orders` and `order_items`. **SQL** is the language for asking a
database questions (called **queries**).

Here is a peek at the `products` table:

| id | name | category | price | stock |
| --- | --- | --- | --- | --- |
| 1 | Wireless Mouse | Electronics | 24.99 | 120 |
| 5 | Python Crash Course | Books | 29.95 | 60 |
| 8 | Steel Water Bottle | Home | 15.0 | 150 |
| … | … | … | … | … |

## SELECT

`SELECT` chooses which **columns** you want, and `FROM` says which table:

```sql
SELECT name, price FROM products;
```

Use `*` to get every column: `SELECT * FROM products;`

## WHERE

`WHERE` keeps only the **rows** that match a condition:

```sql
SELECT name, price
FROM products
WHERE category = 'Books';
```

- Text goes in **single quotes**: `'Books'`.
- Numbers don't: `price < 20`.
- Comparisons: `=`, `<>` (not equal), `<`, `>`, `<=`, `>=`.
- Combine conditions with `AND` (both must be true) or `OR` (either one).

```sql
SELECT name FROM products WHERE category = 'Home' AND price < 20;
```

## Your challenge

List the `name` and `price` of every product in the **Electronics** category that costs
**less than 100**.

Press **Run** to try your query and see the result table. The order of the rows doesn't
matter for this one.
