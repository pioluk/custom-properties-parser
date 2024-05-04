import parse from "../lib";

test("empty", async () => {
	const input = ``;
	const result = await parse(input);
	expect(result).toStrictEqual({});
});

test("empty selector", async () => {
	const input = `body {}`;
	const result = await parse(input);
	expect(result).toStrictEqual({});
});

test("simple variables", async () => {
	const input = `
        :root {
            --var-1: #beeeef;
            --var-2: red;
        }
    `;
	const result = await parse(input);
	expect(result).toStrictEqual({ "--var-1": "#beeeef", "--var-2": "red" });
});

test("multiline variable value", async () => {
	const input = `
        :root {
            --var-1: -apple-system, BlinkMacSystemFont, Segoe UI, Helvetica,
                Arial, sans-serif, Apple Color Emoji, Segoe UI Emojibody;
        }
    `;
	const result = await parse(input);
	expect(result).toStrictEqual({
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
	expect(result).toStrictEqual({
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
	expect(result).toStrictEqual({
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
	expect(result).toStrictEqual({
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
	expect(result).toStrictEqual({ "--var-1": "#beeeef", "--var-2": "red" });
});

test("alias", async () => {
	const input = `
        :root {
            --var-1: #beeeef;
            --var-2: var(--var-1);
        }
    `;
	const result = await parse(input);
	expect(result).toStrictEqual({ "--var-1": "#beeeef", "--var-2": "#beeeef" });
});

test("alias with fallback", async () => {
	const input = `
        :root {
            --var-1: #beeeef;
            --var-2: var(--var-0, red);
        }
    `;
	const result = await parse(input);
	expect(result).toStrictEqual({ "--var-1": "#beeeef", "--var-2": "red" });
});

test("alias non-existent variable without fallback", async () => {
	const input = `
        :root {
            --var-1: var(--color-primary);
        }
    `;
	const result = await parse(input);
	expect(result).toStrictEqual({ "--var-1": undefined });
});

test("pass-through functions other than var", async () => {
	const input = `
        :root {
            --var-1: calc(100% - 16px);
        }
    `;

	const result = await parse(input);
	expect(result).toEqual({
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
	expect(result).toStrictEqual({
		"--var-1": 1,
		"--var-2": 2,
		"--var-3": 3,
		"--var-4": 4,
	});
});
