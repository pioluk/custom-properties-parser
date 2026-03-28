import { deepEqual, deepStrictEqual } from "node:assert";
import { test } from "node:test";
import parse from "../lib/index.js";

test("empty", async () => {
	const input = "";
	const result = await parse(input);
	deepStrictEqual(result, {});
});

test("empty selector", async () => {
	const input = "body {}";
	const result = await parse(input);
	deepStrictEqual(result, {});
});

test("simple variables", async () => {
	const input = `
		:root {
			--var-1: #beeeef;
			--var-2: red;
		}
	`;
	const result = await parse(input);
	deepStrictEqual(result, { "--var-1": "#beeeef", "--var-2": "red" });
});

test("multiline variable value", async () => {
	const input = `
		:root {
			--var-1: -apple-system, BlinkMacSystemFont, Segoe UI, Helvetica,
				Arial, sans-serif, Apple Color Emoji, Segoe UI Emojibody;
		}
	`;
	const result = await parse(input);
	deepStrictEqual(result, {
		"--var-1":
			"-apple-system, BlinkMacSystemFont, Segoe UI, Helvetica, Arial, sans-serif, Apple Color Emoji, Segoe UI Emojibody",
	});
});

test("text values in quotes", async () => {
	const input = `
		:root {
			--var-1: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica,
				Arial, sans-serif, "Apple Color Emoji", 'Segoe UI Emojibody';
		}
	`;
	const result = await parse(input);
	deepStrictEqual(result, {
		"--var-1": `-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emojibody"`,
	});
});

test("numeric values", async () => {
	const input = `
		:root {
			--var-1: 500;
		}
	`;
	const result = await parse(input);
	deepStrictEqual(result, {
		"--var-1": 500,
	});
});

test("unit values", async () => {
	const input = `
		:root {
			--var-1: 12px;
			--var-2: 18pt;
			--var-3: 50vh;
			--var-4: 20;
		}
	`;
	const result = await parse(input);
	deepStrictEqual(result, {
		"--var-1": "12px",
		"--var-2": "18pt",
		"--var-3": "50vh",
		"--var-4": 20,
	});
});

test("multiple selectors", async () => {
	const input = `
		:root {
			--var-1: #beeeef;
		}
		body {
			--var-2: red;
		}
	`;
	const result = await parse(input);
	deepStrictEqual(result, { "--var-1": "#beeeef", "--var-2": "red" });
});

test("alias", async () => {
	const input = `
		:root {
			--var-1: #beeeef;
			--var-2: var(--var-1);
		}
	`;
	const result = await parse(input);
	deepStrictEqual(result, { "--var-1": "#beeeef", "--var-2": "#beeeef" });
});

test("alias with fallback", async () => {
	const input = `
		:root {
			--var-1: #beeeef;
			--var-2: var(--var-0, red);
		}
	`;
	const result = await parse(input);
	deepStrictEqual(result, { "--var-1": "#beeeef", "--var-2": "red" });
});

test("alias non-existent variable without fallback", async () => {
	const input = `
		:root {
			--var-1: var(--color-primary);
		}
	`;
	const result = await parse(input);
	deepStrictEqual(result, { "--var-1": undefined });
});

test("pass-through functions other than var", async () => {
	const input = `
		:root {
			--var-1: calc(100% - 16px);
		}
	`;

	const result = await parse(input);
	deepEqual(result, {
		"--var-1": "calc(100% - 16px)",
	});
});

test("handles scss code", async () => {
	const input = `
		:root {
			@for $i from 1 through 4 {
				--var-#{$i}: #{$i};
			}
		}
	`;

	const result = await parse(input);
	deepStrictEqual(result, {
		"--var-1": 1,
		"--var-2": 2,
		"--var-3": 3,
		"--var-4": 4,
	});
});

test("multiple values", async () => {
	const input = `
		:root {
			--var-1: 20px 0;
			--var-2: 20px 0 3em 1vh;
			--var-3: calc(100% - 5dvh) minmax(200px, 1fr);
		}
	`;

	const result = await parse(input);
	deepStrictEqual(result, {
		"--var-1": "20px 0",
		"--var-2": "20px 0 3em 1vh",
		"--var-3": "calc(100% - 5dvh) minmax(200px, 1fr)",
	});
});

test("handles comments", async () => {
	const input = `
		:root {
			--var-1: /* Lorem ipsum */ 1em;
			--var-2: 2em /* Lorem ipsum */;
			--var-3: 3em; // Lorem ipsum
			--var-4: /* Lorem ipsum */;
		}
	`;

	const result = await parse(input);
	deepEqual(result, {
		"--var-1": "1em",
		"--var-2": "2em",
		"--var-3": "3em",
		"--var-4": "",
	});
});

test("forward reference", async () => {
	const input = `
		:root {
			--var-1: var(--var-2);
			--var-2: red;
		}
	`;
	const result = await parse(input);
	deepStrictEqual(result, { "--var-1": "red", "--var-2": "red" });
});

test("chain of references", async () => {
	const input = `
		:root {
			--a: var(--b);
			--b: var(--c);
			--c: blue;
		}
	`;
	const result = await parse(input);
	deepStrictEqual(result, { "--a": "blue", "--b": "blue", "--c": "blue" });
});

test("circular reference", async () => {
	const input = `
		:root {
			--a: var(--b);
			--b: var(--a);
		}
	`;
	const result = await parse(input);
	deepStrictEqual(result, { "--a": undefined, "--b": undefined });
});

test("nested var() in fallback", async () => {
	const input = `
		:root {
			--var-1: var(--a, var(--b, red));
		}
	`;
	const result = await parse(input);
	deepStrictEqual(result, { "--var-1": "red" });
});

test("nested var() resolves inner reference", async () => {
	const input = `
		:root {
			--b: green;
			--var-1: var(--a, var(--b, red));
		}
	`;
	const result = await parse(input);
	deepStrictEqual(result, { "--b": "green", "--var-1": "green" });
});

test("percentage values", async () => {
	const input = `
		:root {
			--var-1: 50%;
			--var-2: 100%;
		}
	`;
	const result = await parse(input);
	deepStrictEqual(result, { "--var-1": "50%", "--var-2": "100%" });
});

test("url values", async () => {
	const input = `
		:root {
			--var-1: url(image.png);
			--var-2: url(https://example.com/image.jpg);
			--var-3: url("quoted.png");
		}
	`;
	const result = await parse(input);
	deepStrictEqual(result, {
		"--var-1": "url(image.png)",
		"--var-2": "url(https://example.com/image.jpg)",
		"--var-3": "url(quoted.png)",
	});
});

test("negative numbers", async () => {
	const input = `
		:root {
			--var-1: -5;
			--var-2: -3.14;
		}
	`;
	const result = await parse(input);
	deepStrictEqual(result, { "--var-1": -5, "--var-2": -3.14 });
});

test("decimal numbers", async () => {
	const input = `
		:root {
			--var-1: 0.5;
			--var-2: 1.25;
		}
	`;
	const result = await parse(input);
	deepStrictEqual(result, { "--var-1": 0.5, "--var-2": 1.25 });
});

test("comma normalization in non-var functions", async () => {
	const input = `
		:root {
			--var-1: rgb(255,0,0);
		}
	`;
	const result = await parse(input);
	deepStrictEqual(result, { "--var-1": "rgb(255, 0, 0)" });
});

test("duplicate declarations use last value", async () => {
	const input = `
		:root {
			--var-1: red;
			--var-1: blue;
		}
	`;
	const result = await parse(input);
	deepStrictEqual(result, { "--var-1": "blue" });
});

test("self-referencing variable", async () => {
	const input = `
		:root {
			--a: var(--a);
		}
	`;
	const result = await parse(input);
	deepStrictEqual(result, { "--a": undefined });
});
