export type JoinableChunk<T> = { type: "value"; value: T } | { type: "punctuation"; value: T };

export function Punctuation<T>(value: T): JoinableChunk<T> {
	return { type: "punctuation", value };
}

export function Value<T>(value: T): JoinableChunk<T> {
	return { type: "value", value };
}

export function join(input: Array<JoinableChunk<unknown>>): string {
	return input
		.flatMap((item, index) =>
			index === 0 || item.type === "punctuation" ? [item.value] : [" ", item.value],
		)
		.join("");
}
