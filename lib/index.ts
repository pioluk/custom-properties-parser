import postcss, { Declaration } from "postcss";
import { ChildNode, Func, Numeric, parse as parseValue, Root } from "postcss-values-parser";
import * as sass from "sass";
import { MapKey, MapValue } from "./types";
export type PropertyValue = undefined | number | string;

type PropertyRegistry = Map<string, PropertyValue>;

export default async function parse(input: string): Promise<Record<string, PropertyValue>> {
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

function isCustomProperty(node: Declaration) {
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
        throw new Error(`Unsupported function "${func.name}"`);
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

function isEmpty(a: ArrayLike<any>) {
    return a.length === 0;
}

function mapToRecord<M extends Map<number | string, any>>(map: M): Record<MapKey<M>, MapValue<M>> {
    return Array.from(map.entries()).reduce<Record<number | string, any>>((record, [key, value]) => {
        record[key] = value;
        return record;
    }, {});
}