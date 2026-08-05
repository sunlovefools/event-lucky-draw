export function createShuffledNameDeck(
  names: string[],
  previous = "",
  random: () => number = Math.random,
) {
  const pool = Array.from(new Set(names.filter(Boolean)));
  let deck: string[] = [];
  let index = 0;
  let lastName = previous;

  return function nextName() {
    if (pool.length === 0) return "";
    if (pool.length === 1) return pool[0];

    if (index >= deck.length) {
      deck = [...pool];
      for (let position = deck.length - 1; position > 0; position -= 1) {
        const swapWith = Math.floor(random() * (position + 1));
        [deck[position], deck[swapWith]] = [deck[swapWith], deck[position]];
      }

      if (deck[0] === lastName) {
        const swapWith = 1 + Math.floor(random() * (deck.length - 1));
        [deck[0], deck[swapWith]] = [deck[swapWith], deck[0]];
      }
      index = 0;
    }

    lastName = deck[index];
    index += 1;
    return lastName;
  };
}
