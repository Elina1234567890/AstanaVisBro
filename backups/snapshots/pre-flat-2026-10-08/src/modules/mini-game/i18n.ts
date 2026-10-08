import { makeT } from "@idosgames/react/ui";

// Strings of the mini-game. The leaderboard's name is the publisher's word (title config).

const EN = {
  title: "Star catch",
  play: "Play",
  playAgain: "Play again",
  tapStars: "Tap the stars!",
  timeLeft: "Time",
  score: "Score",
  yourScore: "Your score",
  submitted: "Submitted to the leaderboard",
  seasonStatus: "season status",
  toTable: "Leaderboard",
  best: "Tap as many stars as you can in 15 seconds. Gold stars are worth 3.",
} as const;

export type StringKey = keyof typeof EN;

export const t = makeT<StringKey>(EN, {
  title: "Ловец звёзд",
  play: "Играть",
  playAgain: "Ещё раз",
  tapStars: "Ловите звёзды!",
  timeLeft: "Время",
  score: "Очки",
  yourScore: "Ваш результат",
  submitted: "Результат отправлен в таблицу",
  seasonStatus: "статуса сезона",
  toTable: "Таблица лидеров",
  best: "Поймайте как можно больше звёзд за 15 секунд. Золотая — 3 очка.",
});
