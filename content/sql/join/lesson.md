---
title: Joining tables
order: 3
difficulty: intermediate
xp: 30
type: query
language: sql
summary: Combine rows from two tables with JOIN.
hints:
  - "Start with FROM orders JOIN customers ON customers.id = orders.customer_id"
  - "Pick columns with the table name in front: orders.id, customers.name, orders.status"
  - "Filter with WHERE orders.status = 'delivered'"
---

Our shop keeps customers and orders in **separate tables**. Each order only stores the *id* of the
customer who placed it:

**orders**

| id | customer_id | ordered_on | status |
| --- | --- | --- | --- |
| 1 | 1 | 2024-09-01 | delivered |
| 2 | 3 | 2024-09-03 | delivered |
| 3 | 2 | 2024-09-07 | shipped |

**customers**

| id | name | city |
| --- | --- | --- |
| 1 | Amara Okafor | Lagos |
| 2 | Liam Murphy | Dublin |
| 3 | Sofia Rossi | Milan |

Storing each customer once and *pointing* to them from orders avoids repeating their details on
every order. `customer_id` is called a **foreign key**.

## JOIN

To see orders together with customer names, **join** the tables on the matching columns:

```sql
SELECT orders.id, customers.name, orders.ordered_on
FROM orders
JOIN customers ON customers.id = orders.customer_id;
```

- `JOIN customers` adds the customers table.
- `ON customers.id = orders.customer_id` says which rows belong together.
- Because both tables have an `id` column, write `table.column` to say which one you mean.

## Shorter names

You can give tables short **aliases**:

```sql
SELECT o.id, c.name
FROM orders o
JOIN customers c ON c.id = o.customer_id;
```

## JOIN with WHERE

You can still filter, sort and limit as usual:

```sql
SELECT o.id, c.name
FROM orders o
JOIN customers c ON c.id = o.customer_id
WHERE c.country = 'Philippines';
```

## Your challenge

List every order with the status `'delivered'`. For each one, return three columns: the order's
`id`, the customer's `name`, and the order's `status`.

The order of the rows doesn't matter.
