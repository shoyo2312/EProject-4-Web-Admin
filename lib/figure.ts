/**
 * A figure as the console prints it — "18,975", "27.9m", "291 / 221", "8h" — taken apart into its
 * numbers and the text around them, so it can be drawn part of the way to its value: counting up
 * as its card arrives, or across from the value it showed before.
 */
export interface Figure {
  /** The text before, between and after the numbers: one entry more than `numbers`. */
  text: string[];
  numbers: { value: number; decimals: number; grouped: boolean }[];
}

const NUMBER = /\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?/g;
const grouping = new Map<number, Intl.NumberFormat>();

/** Null for a figure with no number in it to count: "—". */
export function parseFigure(printed: string): Figure | null {
  const text: string[] = [];
  const numbers: Figure["numbers"] = [];
  let end = 0;
  for (const match of printed.matchAll(NUMBER)) {
    const digits = match[0];
    const point = digits.indexOf(".");
    text.push(printed.slice(end, match.index));
    numbers.push({
      value: Number(digits.replaceAll(",", "")),
      decimals: point === -1 ? 0 : digits.length - point - 1,
      grouped: digits.includes(","),
    });
    end = match.index + digits.length;
  }
  if (numbers.length === 0) return null;
  text.push(printed.slice(end));
  return { text, numbers };
}

/**
 * Whether `from` can count across to `to`: the same words around the same count of numbers. A
 * figure that changed unit — "980k" to "1.2m", "23h" to "1d" — cannot, and is shown as it is.
 */
export function sameShape(from: Figure, to: Figure): boolean {
  return (
    from.numbers.length === to.numbers.length &&
    from.text.every((text, i) => text === to.text[i])
  );
}

/**
 * `figure` drawn `progress` of the way, 0 to 1, from `from` — or from zero — to its own value, in its
 * own decimals and grouping. At 1 it reads exactly as printed.
 */
export function figureAt(figure: Figure, progress: number, from?: Figure): string {
  return figure.text.reduce((drawn, text, i) => {
    const number = figure.numbers[i - 1];
    if (!number) return drawn + text;
    const start = from?.numbers[i - 1]?.value ?? 0;
    const value = start + (number.value - start) * progress;
    return drawn + format(value, number.decimals, number.grouped) + text;
  }, "");
}

function format(value: number, decimals: number, grouped: boolean): string {
  if (!grouped) return value.toFixed(decimals);
  let formatter = grouping.get(decimals);
  if (!formatter) {
    formatter = new Intl.NumberFormat("en-US", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
    grouping.set(decimals, formatter);
  }
  return formatter.format(value);
}
