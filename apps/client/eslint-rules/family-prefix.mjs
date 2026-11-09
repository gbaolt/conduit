import path from 'node:path';

const pascal = (kebab) =>
  kebab.replace(/(^|-)([a-z0-9])/g, (_, __, c) => c.toUpperCase());

/** `room-sidebar.tsx` → `Room`; an `index.tsx` takes its folder's name. */
export function familyOf(filename) {
  const base = path.basename(filename).replace(/\.[jt]sx?$/, '');
  const name = base === 'index' ? path.basename(path.dirname(filename)) : base;
  return pascal(name.split('-')[0]);
}

const isComponentName = (name) => /^[A-Z][a-z]/.test(name);

/** @type {import('eslint').Rule.RuleModule} */
export const familyPrefix = {
  meta: {
    type: 'suggestion',
    messages: {
      prefix:
        '{{name}} sits in a {{family}} file, so its name starts with {{family}}. Give a different component its own file, named after it.',
    },
  },
  create(context) {
    const family = familyOf(context.filename);
    const check = (node, name) => {
      if (!isComponentName(name)) return;
      if (name.toLowerCase().startsWith(family.toLowerCase())) return;
      context.report({ node, messageId: 'prefix', data: { name, family } });
    };

    return {
      ExportNamedDeclaration(node) {
        const { declaration } = node;
        if (declaration?.type === 'FunctionDeclaration' && declaration.id) {
          check(declaration.id, declaration.id.name);
        }
        if (declaration?.type === 'VariableDeclaration') {
          for (const { id } of declaration.declarations) {
            if (id.type === 'Identifier') check(id, id.name);
          }
        }
        if (!node.source && node.exportKind !== 'type') {
          for (const specifier of node.specifiers) {
            if (specifier.exportKind === 'type') continue;
            check(specifier.exported, specifier.exported.name);
          }
        }
      },
    };
  },
};

export default { rules: { 'family-prefix': familyPrefix } };
