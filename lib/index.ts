import * as csstree from "css-tree";
import * as sass from "sass";

export type PropertyValue = undefined | number | string;
type Registry = Map<string, PropertyValue>;

export default async function parse(input: string): Promise<Record<string, PropertyValue>> {
	const { css } = await sass.compileStringAsync(input);
	const ast = csstree.parse(css, { context: "stylesheet" });

	const raw = collect(ast);
	const resolved = resolve(raw);

	return Object.fromEntries(resolved);
}

function collect(ast: csstree.CssNode): Map<string, string> {
	const raw = new Map<string, string>();
	csstree.walk(ast, (node) => {
		if (
			node.type === "Declaration" &&
			node.property.startsWith("--") &&
			node.value.type === "Raw"
		) {
			raw.set(node.property, node.value.value);
		}
	});
	return raw;
}

function resolve(raw: Map<string, string>): Registry {
	const resolved: Registry = new Map();

	let changed = true;
	while (changed) {
		changed = false;
		for (const [name, rawValue] of raw) {
			if (resolved.has(name)) continue;
			try {
				const value = parseRaw(rawValue, resolved);
				resolved.set(name, value);
				changed = true;
			} catch {
				// unresolved var() reference — try again next pass
			}
		}
	}

	for (const name of raw.keys()) {
		if (!resolved.has(name)) {
			resolved.set(name, undefined);
		}
	}

	return resolved;
}

function extractValue(node: csstree.CssNode, registry: Registry): PropertyValue {
	if (node.type === "Value") {
		return node.children.size === 1
			? parseNode(node.children.first!, registry)
			: joinValues(node.children.toArray().map((child) => parseNode(child, registry)));
	}
	return undefined;
}

function parseRaw(value: string, registry: Registry): PropertyValue {
	const cleaned = value
		.replace(/\/\*[\s\S]*?\*\//g, "")
		.replace(/(?<!:)\/\/.*$/gm, "")
		.trim();

	if (cleaned === "") {
		return "";
	}

	if (/^-?\d+(\.\d+)?$/.test(cleaned)) {
		return Number(cleaned);
	}

	let ast: csstree.CssNode;
	try {
		ast = csstree.parse(cleaned, { context: "value" });
	} catch {
		return cleaned;
	}

	if (ast.type === "Value") {
		return extractValue(ast, registry);
	}

	return cleaned;
}

function parseNode(node: csstree.CssNode, registry: Registry): PropertyValue {
	switch (node.type) {
		case "Identifier":
			return node.name;
		case "String":
			return csstree.generate(node);
		case "Number":
			return Number(node.value);
		case "Dimension":
			return `${node.value}${node.unit}`;
		case "Percentage":
			return `${node.value}%`;
		case "Function":
			return parseFunction(node, registry);
		case "Operator":
			return node.value;
		case "Raw":
			return parseRaw(node.value, registry);
		case "Url":
			return csstree.generate(node);
		default:
			return csstree.generate(node);
	}
}

function parseFunction(func: csstree.FunctionNode, registry: Registry): PropertyValue {
	if (func.name !== "var") {
		return csstree.generate(func).replace(/,(?![\s,])/g, ", ");
	}

	const children = func.children.toArray();
	if (children.length === 0) {
		return undefined;
	}

	const varName = children[0];
	const commaIdx = children.findIndex((c) => c.type === "Operator" && c.value === ",");

	if (varName.type === "Identifier" && varName.name.startsWith("--")) {
		if (registry.has(varName.name)) {
			return registry.get(varName.name);
		}
		if (commaIdx === -1) {
			throw new Error(`unresolved: ${varName.name}`);
		}
	}

	if (commaIdx !== -1 && commaIdx < children.length - 1) {
		const fallbackChildren = children.slice(commaIdx + 1);
		const parsed =
			fallbackChildren.length === 1
				? parseNode(fallbackChildren[0], registry)
				: joinValues(fallbackChildren.map((c) => parseNode(c, registry)));
		return typeof parsed === "string" ? parsed.trim() : parsed;
	}

	return undefined;
}

function joinValues(values: PropertyValue[]): string {
	return values
		.filter((v): v is string | number => v !== undefined)
		.map((v, i, arr) => {
			const str = String(v);
			const prev = i > 0 ? String(arr[i - 1]) : "";
			if (i > 0 && !/^[,)]/.test(str) && !/[(+-]$/.test(prev)) {
				return ` ${str}`;
			}
			return str;
		})
		.join("")
		.trim();
}
