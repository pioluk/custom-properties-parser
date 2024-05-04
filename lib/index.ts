import postcss, { Declaration } from "postcss";
import { ChildNode, Func, Numeric, parse as parseValue, Root } from "postcss-values-parser";
import * as sass from "sass";
import { join, Punctuation, Value, type JoinableChunk } from "./joinable";

export type PropertyValue = undefined | number | string;

type PropertyRegistry = Map<string, PropertyValue>;
type Result = Record<string, PropertyValue>;

export default async function parse(input: string): Promise<Result> {
	const customPropertyRegistry = new Map<string, PropertyValue>();

	const { css } = await sass.compileStringAsync(input);
	const result = await postcss().process(css.toString(), { from: undefined, map: false });
	result.root?.walkDecls((decl) => {
		if (isCustomProperty(decl)) {
			const { prop, value } = decl;
			const parsed = parseValue(value);
			customPropertyRegistry.set(prop, getValue(parsed, customPropertyRegistry));
		}
	});

	return mapToRecord(customPropertyRegistry);
}

function isCustomProperty(node: Declaration): boolean {
	return node.prop.startsWith("--");
}

function getValue(root: Root, customPropertyRegistry: PropertyRegistry): PropertyValue {
	return collectNodes(root.nodes, customPropertyRegistry);
}

function collectNodes(nodes: ChildNode[], customPropertyRegistry: PropertyRegistry): PropertyValue {
	if (nodes.length === 1) {
		// If we have only one node, then parse it separately without joining to prevent converting number to string
		return parseNode(nodes[0], customPropertyRegistry).value;
	}
	return join(nodes.map((node) => parseNode(node, customPropertyRegistry)));
}

function parseNode(node: ChildNode, customPropertyRegistry: PropertyRegistry): JoinableChunk<PropertyValue> {
	switch (node.type) {
		case "word":
		case "quoted":
			return Value(node.value);

		case "punctuation":
			return Punctuation(node.value);

		case "numeric":
			return Value(parseNumericValue(node));

		case "func":
			return Value(parseFunc(node, customPropertyRegistry));

		default:
			throw new Error(`Unsupported node type: "${node.type}"`);
	}
}

function parseNumericValue(node: Numeric): PropertyValue {
	return node.unit ? `${node.value}${node.unit}` : +node.value;
}

function parseFunc(func: Func, customPropertyRegistry: PropertyRegistry): PropertyValue {
	if (func.name !== "var") {
		return func.toString();
	}

	const args = func.nodes;
	if ("value" in args[0]) {
		const customPropertyName = args[0].value;
		if (customPropertyRegistry.has(customPropertyName)) {
			return customPropertyRegistry.get(customPropertyName)!;
		}
	}

	const fallback = args[2];
	if (!fallback || !("value" in fallback)) {
		return undefined;
	}

	return fallback.value;
}

function mapToRecord<V>(map: Map<PropertyKey, V>): Record<PropertyKey, V> {
	return Object.fromEntries(map.entries());
}
