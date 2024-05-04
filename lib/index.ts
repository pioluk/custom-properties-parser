import postcss, { Declaration } from "postcss";
import { ChildNode, Func, Numeric, parse as parseValue, Root } from "postcss-values-parser";
import * as sass from "sass";

export type PropertyValue = undefined | number | string;

type PropertyRegistry = Map<string, PropertyValue>;
type Result = Record<string, PropertyValue>;

export default async function parse(input: string): Promise<Result> {
	const customPropertyRegistry = new Map<string, PropertyValue>();

	const { css } = sass.renderSync({ data: input });
	const result = await postcss().process(css.toString());
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
	if (root.nodes.length === 1) {
		const node = root.nodes[0];
		if (node.type == "word" || node.type === "quoted") {
			return node.value;
		} else if (node.type === "numeric") {
			return parseNumericValue(node);
		} else if (node.type === "func") {
			return compileFunc(node, customPropertyRegistry);
		}
		throw new Error(`Unsupported node type: "${node.type}"`);
	} else if (root.nodes.length > 1) {
		return collectNodes(root.nodes);
	}

	return undefined;
}

function collectNodes(nodes: ChildNode[]): string {
	return nodes
		.reduce<string[]>((acc, node) => {
			if (node.type === "word" || node.type === "quoted") {
				return isEmpty(acc) ? [...acc, node.value] : [...acc, " ", node.value];
			} else if (node.type === "punctuation") {
				return [...acc, ","];
			}

			// else ignore
			return acc;
		}, [])
		.join("");
}

function parseNumericValue(node: Numeric): PropertyValue {
	return node.unit ? `${node.value}${node.unit}` : +node.value;
}

function compileFunc(func: Func, customPropertyRegistry: PropertyRegistry): PropertyValue {
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

function isEmpty(a: ArrayLike<any>): boolean {
	return a.length === 0;
}

function mapToRecord<V>(map: Map<PropertyKey, V>): Record<PropertyKey, V> {
	return Object.fromEntries(map.entries());
}
