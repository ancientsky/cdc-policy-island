// Original implementation for this project. Not derived from third-party source code.

export const MISSIONS = [
  { id: "m1", key: "mission1", check: (book) => Object.keys(book.islands).length > 0 },
  { id: "m2", key: "mission2", check: (book) => Boolean(book.islands.border) },
  { id: "m3", key: "mission3", check: (book) => Object.keys(book.items).length > 0 },
  { id: "m4", key: "mission4", check: (_book, game) => Number(game?.total) >= 3 },
  { id: "m5", key: "mission5", check: (book) => Object.keys(book.flows).length > 0 },
  { id: "m6", key: "mission6", check: (_book, _game, ui) => {
    const minutes = Number(ui?.minutes);
    return minutes >= 1200 && minutes <= 1260;
  } },
  { id: "m7", key: "mission7", check: (book, _game, ui) => Boolean(ui?.mosquito) && Boolean(book.islands.dengue) },
  { id: "m8", key: "mission8", check: (book) => Object.keys(book.islands).length >= 14 },
];
