/** UI-only rules: business headings and Next metadata titles are not hover hints. */
const forwardedTags = new Set([
  "Link", "Image", "Button", "Badge", "Card", "CardHeader", "CardTitle", "CardContent",
  "CardDescription", "CardFooter", "CardAction", "Input", "Textarea", "Label", "Switch",
  "SelectTrigger", "SelectItem", "TabsTrigger", "TooltipTrigger", "ToneChip", "TextBand", "AutoFitPrice",
]);
const semanticTitles = new Set(["Section", "HeaderMetric"]);

function tagName(node) {
  if (node.type === "JSXIdentifier") return node.name;
  if (node.type === "JSXMemberExpression") return `${tagName(node.object)}.${tagName(node.property)}`;
  return "";
}
function rendersTitle(name) {
  return name !== "iframe" && !semanticTitles.has(name) && (/^[a-z]/.test(name) || forwardedTags.has(name));
}
function isEmpty(value) {
  return value?.type === "Literal" && value.value === ""
    || value?.type === "JSXExpressionContainer" && value.expression?.type === "Literal" && value.expression.value === "";
}

export default {
  rules: {
    "no-native-tooltip": {
      meta: {
        type: "problem",
        schema: [],
        messages: {
          native: "禁止浏览器默认悬浮提示。普通说明用 data-tooltip，ToneChip/TextBand/AutoFitPrice 用 tooltip，复杂说明用共享 TooltipContent。",
          svg: "SVG <title> 会产生默认悬浮提示。请用 aria-label 提供名称，并用 data-tooltip 显示提示。",
        },
      },
      create(context) {
        return {
          JSXOpeningElement(node) {
            const name = tagName(node.name);
            if (!rendersTitle(name)) return;
            for (const attribute of node.attributes) {
              if (attribute.type === "JSXAttribute" && attribute.name.name === "title" && !isEmpty(attribute.value)) context.report({ node: attribute, messageId: "native" });
              if (attribute.type === "JSXSpreadAttribute" && attribute.argument.type === "ObjectExpression") {
                for (const property of attribute.argument.properties) {
                  if (property.type === "Property" && (property.key.name ?? property.key.value) === "title" && !isEmpty(property.value)) context.report({ node: property, messageId: "native" });
                }
              }
            }
            if (name === "title") {
              let parent = node.parent;
              while (parent) {
                if (parent.type === "JSXElement" && tagName(parent.openingElement.name) === "svg") {
                  context.report({ node, messageId: "svg" }); break;
                }
                parent = parent.parent;
              }
            }
          },
          CallExpression(node) {
            if (node.callee.type === "MemberExpression" && node.callee.property.name === "setAttribute" && node.arguments[0]?.value === "title" && !isEmpty(node.arguments[1])) context.report({ node, messageId: "native" });
          },
          AssignmentExpression(node) {
            const left = node.left;
            if (left.type !== "MemberExpression" || (left.property.name ?? left.property.value) !== "title" || isEmpty(node.right)) return;
            // Do not mistake document.title / model.title / result.title for DOM hints.
            const object = left.object;
            const domName = object.type === "Identifier" ? object.name : object.type === "MemberExpression" ? object.property.name : "";
            if (["el", "element", "node", "target", "currentTarget"].includes(domName)) context.report({ node, messageId: "native" });
          },
        };
      },
    },
    "shared-tooltip-only": {
      meta: {
        type: "problem",
        schema: [],
        messages: { shared: "悬浮窗必须复用 @/components/ui/tooltip 的统一样式，禁止在业务组件中另起 Tooltip.Popup。" },
      },
      create(context) {
        const shared = context.filename.replace(/\\/g, "/").endsWith("/src/components/ui/tooltip.tsx");
        if (shared) return {};
        return {
          ImportDeclaration(node) {
            const source = node.source.value;
            if (typeof source !== "string") return;
            if (source.startsWith("@base-ui/react/tooltip") || source === "@base-ui/react" && node.specifiers.some(specifier => specifier.type === "ImportSpecifier" && specifier.imported.name === "Tooltip")) context.report({ node, messageId: "shared" });
          },
          JSXOpeningElement(node) {
            for (const attribute of node.attributes) {
              if (attribute.type === "JSXAttribute" && attribute.name.name === "role" && attribute.value?.value === "tooltip") context.report({ node, messageId: "shared" });
            }
          },
        };
      },
    },
  },
};
