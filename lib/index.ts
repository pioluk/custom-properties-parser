import * as csstree from "css-tree";
import * as sass from "sass";

export type PropertyValue = undefined | number | string;
type Registry = Map<string, PropertyValue>;

export default async function parse(input: string): Promise<Record<string, PropertyValue>> {
	const registry: Registry = new Map();

	const { css } = await sass.compileStringAsync(input);
	const ast = csstree.parse(css, { context: "stylesheet" });

	csstree.walk(ast, (node) => {
		if (node.type === "Declaration" && node.property.startsWith("--")) {
			registry.set(node.property, extractValue(node.value, registry));
		}
	});

	return Object.fromEntries(registry);
}

function extractValue(node: csstree.CssNode, registry: Registry): PropertyValue {
	if (node.type === "Raw") {
		return parseRaw(node.value, registry);
	}
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
		.replace(/\/\/.*$/gm, "")
		.trim();

	if (cleaned === "") {
		return "";
	}

	if (/^-?\d+(\.\d+)?$/.test(cleaned)) {
		return Number(cleaned);
	}

	try {
		const ast = csstree.parse(cleaned, { context: "value" });
		if (ast.type === "Value") {
			return extractValue(ast, registry);
		}
	} catch {
		// Fall through
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
		case "Raw":
			return node.value;
		case "Url":
			return `url(${node.value})`;
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
	if (varName.type === "Identifier" && varName.name.startsWith("--")) {
		const resolved = registry.get(varName.name);
		if (resolved !== undefined) {
			return resolved;
		}
	}

	const commaIdx = children.findIndex((c) => c.type === "Operator" && c.value === ",");
	if (commaIdx !== -1 && commaIdx < children.length - 1) {
		const fallback = children
			.slice(commaIdx + 1)
			.map((c) => csstree.generate(c))
			.join("")
			.trim();

		try {
			const ast = csstree.parse(fallback, { context: "value" });
			if (ast.type === "Value") {
				const parsed = extractValue(ast, registry);
				return typeof parsed === "string" ? parsed.trim() : parsed;
			}
		} catch {}
		return fallback;
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
