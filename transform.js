const path = require('path');
const {declare, traverse, types} = require('playwright/lib/transform/babelBundle');
const {setTransformData} = require('playwright/lib/transform/transform');

/** @type {typeof import('@babel/core').types} */
const t = types;

/**
 * @typedef {object} ImportInfo
 * @param {string} id
 * @param {string} filename
 * @param {string} importSource
 * @param {string | undefined} remoteName
 */

/** @type {Set<string>} */
let jsxComponentNames;
/** @type {Set<string>} */
let classComponentNames;
/** @type {Map<string, ImportInfo>} */
let importInfos;

/**
 * @param {import('@types/babel__helper-plugin-utils').BabelAPI} api
 * @return {import('@babel/core').PluginObj}
 */
export default declare((api) => {
    api.assertVersion(7);

    return {
        name: 'playwright-debug-transform',
        visitor: {
            Program: {
                enter(path) {
                    jsxComponentNames = collectJsxComponentUsages(path.node);
                    classComponentNames = collectClassMountUsages(path.node);
                    importInfos = new Map();
                },
                exit(path) {
                    let firstDeclaration;
                    let lastImportDeclaration;
                    path.get('body').forEach(p => {
                        if (p.isImportDeclaration())
                            lastImportDeclaration = p;
                        else if (!firstDeclaration)
                            firstDeclaration = p;
                    });
                    const insertionPath = lastImportDeclaration || firstDeclaration;
                    if (!insertionPath)
                        return;

                    for (const [localName, componentImport] of [...importInfos.entries()].reverse()) {
                        insertionPath.insertAfter(
                            t.variableDeclaration(
                                'const',
                                [
                                    t.variableDeclarator(
                                        t.identifier(localName),
                                        t.objectExpression([
                                            t.objectProperty(t.identifier('__pw_type'), t.stringLiteral('importRef')),
                                            t.objectProperty(t.identifier('id'), t.stringLiteral(componentImport.id)),
                                        ]),
                                    )
                                ]
                            )
                        );
                    }
                    setTransformData('playwright-ct-core', [...importInfos.values()]);
                }
            },

            ImportDeclaration(p) {
                const importNode = p.node;
                if (!t.isStringLiteral(importNode.source))
                    return;

                const ext = path.extname(importNode.source.value);

                // Convert all non-JS imports into refs.
                if (artifactExtensions.has(ext)) {
                    for (const specifier of importNode.specifiers) {
                        if (t.isImportNamespaceSpecifier(specifier))
                            continue;
                        const {localName, info} = importInfo(importNode, specifier, this.filename);
                        importInfos.set(localName, info);
                    }
                    p.skip();
                    p.remove();
                    return;
                }

                // Convert JS imports that are used as components in JSX expressions into refs.
                let importCount = 0;
                for (const specifier of importNode.specifiers) {
                    if (t.isImportNamespaceSpecifier(specifier))
                        continue;
                    const {localName, info} = importInfo(importNode, specifier, this.filename);
                    if (jsxComponentNames.has(localName) || classComponentNames.has(localName)) {
                        importInfos.set(localName, info);
                        ++importCount;
                    }
                }

                // All the imports were from JSX => delete.
                if (importCount && importCount === importNode.specifiers.length) {
                    p.skip();
                    p.remove();
                }
            },

            MemberExpression(path) {
                if (!t.isIdentifier(path.node.object)) return;
                if (!importInfos.has(path.node.object.name)) return;
                if (!t.isIdentifier(path.node.property)) return;
                path.replaceWith(
                    t.objectExpression([
                        t.spreadElement(t.identifier(path.node.object.name)),
                        t.objectProperty(t.identifier('property'), t.stringLiteral(path.node.property.name)),
                    ])
                );
            },
        }
    };
});

/**
 * @param {import('@babel/core').types.Node} node
 * @return {Set<string>}
 */
function collectJsxComponentUsages(node) {
    /** @type {Set<string>} */
    const names = new Set();
    traverse(node, {
        enter: p => {
            // Treat JSX-everything as component usages.
            if (t.isJSXElement(p.node)) {
                if (t.isJSXIdentifier(p.node.openingElement.name))
                    names.add(p.node.openingElement.name.name);
                if (t.isJSXMemberExpression(p.node.openingElement.name) && t.isJSXIdentifier(p.node.openingElement.name.object) && t.isJSXIdentifier(p.node.openingElement.name.property))
                    names.add(p.node.openingElement.name.object.name);
            }
        }
    });
    return names;
}

/**
 * @param {import('@babel/core').types.Node} node
 * @return {Set<string>}
 */
function collectClassMountUsages(node) {
    /** @type {Set<string>} */
    const names = new Set();
    traverse(node, {
        enter: p => {
            if (t.isCallExpression(p.node) && t.isIdentifier(p.node.callee) && p.node.callee.name === 'mount') {
                p.traverse({
                    Identifier: p => {
                        names.add(p.node.name);
                    }
                });
            }
        }
    });
    return names;
}


/**
 *
 * @param {import('@babel/core').types.ImportDeclaration} importNode
 * @param {import('@babel/core').types.ImportSpecifier | import('@babel/core').types.ImportDefaultSpecifier} specifier
 * @param {string} filename
 * @return {{localName, info: ImportInfo}}
 */
export function importInfo(importNode, specifier, filename) {
    const importSource = importNode.source.value;
    const idPrefix = path.join(filename, '..', importSource).replace(/[^\w_\d]/g, '_');

    const result = {
        id: idPrefix,
        filename,
        importSource,
        remoteName: undefined,
    };

    if (t.isImportDefaultSpecifier(specifier)) {
    } else if (t.isIdentifier(specifier.imported)) {
        result.remoteName = specifier.imported.name;
    } else {
        result.remoteName = specifier.imported.value;
    }

    if (result.remoteName)
        result.id += '_' + result.remoteName;

    return {localName: specifier.local.name, info: result};
}

const artifactExtensions = new Set([
    // Frameworks

    // Template engines
    '.twig',

    // Images
    '.jpg',
    '.jpeg',
    '.png',
    '.gif',
    '.svg',
    '.bmp',
    '.webp',
    '.ico',

    // CSS
    '.css',

    // Fonts
    '.woff',
    '.woff2',
    '.ttf',
    '.otf',
    '.eot',
]);
