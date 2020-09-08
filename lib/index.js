const postcss = require("postcss");
const { parse: parseValue } = require("postcss-values-parser");
const { parse } = require("postcss-values-parser");
const sass = require("sass");
const util = require("util");

const renderSass = util.promisify(sass.render);

module.exports = async function parse(input) {
    const customPropertyRegistry = {};

    const result = await postcss().process((await renderSass({ data: input })).css.toString());
    result.root.walkDecls((decl) => {
        if (isCustomProperty(decl)) {
            const { prop, value } = decl;
            const parsed = parseValue(value);
            customPropertyRegistry[prop] = getValue(parsed, customPropertyRegistry);
        }
    });

    return customPropertyRegistry;
};

function isCustomProperty(node) {
    return node.prop.startsWith("--");
}

function getValue(root, customPropertyRegistry) {
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

    return null;
}

function collectNodes(nodes) {
    return nodes
        .reduce((acc, node) => {
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

function parseNumericValue(node) {
    return node.unit ? `${node.value}${node.unit}` : +node.value;
}

function compileFunc(func, customPropertyRegistry) {
    if (func.name !== "var") {
        throw new Error(`Unsupported function "${func.name}"`);
    }

    const args = func.nodes;
    const customPropertyName = args[0].value;
    if (customPropertyRegistry.hasOwnProperty(customPropertyName)) {
        return customPropertyRegistry[customPropertyName];
    }

    const fallback = args[2];
    if (!fallback) {
        return undefined;
    }

    return fallback.value;
}

function isEmpty(a) {
    return a.length === 0;
}
