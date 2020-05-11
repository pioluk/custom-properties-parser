const test = require("tape");
const parse = require("../");

test("empty", async (t) => {
    const input = ``;
    const result = await parse(input);
    t.deepEqual(result, {});
    t.end();
});

test("empty selector", async (t) => {
    const input = `body {}`;
    const result = await parse(input);
    t.deepEqual(result, {});
    t.end();
});

test("simple variables", async (t) => {
    const input = `
        :root {
            --var-1: #beeeef;
            --var-2: red;
        }
    `;
    const result = await parse(input);
    t.deepEqual(result, { "--var-1": "#beeeef", "--var-2": "red" });
    t.end();
});

test("multiple selectors", async (t) => {
    const input = `
        :root {
            --var-1: #beeeef;
        }
        body {
            --var-2: red;
        }
    `;
    const result = await parse(input);
    t.deepEqual(result, { "--var-1": "#beeeef", "--var-2": "red" });
    t.end();
});

test("alias", async (t) => {
    const input = `
        :root {
            --var-1: #beeeef;
            --var-2: var(--var-1);
        }
    `;
    const result = await parse(input);
    t.deepEqual(result, { "--var-1": "#beeeef", "--var-2": "#beeeef" });
    t.end();
});

test("alias with fallback", async (t) => {
    const input = `
        :root {
            --var-1: #beeeef;
            --var-2: var(--var-0, red);
        }
    `;
    const result = await parse(input);
    t.deepEqual(result, { "--var-1": "#beeeef", "--var-2": "red" });
    t.end();
});

test("alias non-existent variable without fallback", async (t) => {
    const input = `
        :root {
            --var-1: var(--color-primary);
        }
    `;
    const result = await parse(input);
    t.deepEqual(result, { "--var-1": undefined });
    t.end();
});

test("fails with any function other than var", async (t) => {
    t.plan(1);

    const input = `
        :root {
            --var-1: calc(100% - 16px);
        }
    `;

    try {
        await parse(input);
        t.fail();
    } catch (err) {
        t.pass();
    }
});
