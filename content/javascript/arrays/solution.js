function sumOfEvens(numbers) {
  let total = 0;
  for (const n of numbers) {
    if (n % 2 === 0) {
      total = total + n;
    }
  }
  return total;
}

console.log(sumOfEvens([1, 2, 3, 4]));
