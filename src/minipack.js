const fs = require('fs');
const path = require('path');
const babelParser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const babel = require("@babel/core");

let ID = 0;

function createAsset(filename) {
    const content = fs.readFileSync(filename, 'utf8');

    const ast = babelParser.parse(content, {
        sourceType: "module",
    });

    let dependencies = [];
    traverse(ast, {
        enter(p) {
            if (p.node.type === "ImportDeclaration") {
                dependencies.push(p.node.source.value);
            }
          }
    });
    
    let { code } = babel.transformFromAstSync(ast, null, {
        presets: ['@babel/preset-env']
    });

    return {
        id: ID++,
        filename,
        code,
        dependencies
    };
}

function createGraph(entry) {
    let mainAsset = createAsset(entry);
    let queue = [ mainAsset ];
    let graph = [ mainAsset ];
    // BFS
    while(queue.length) {
        let asset = queue.shift();
        const dirname = path.dirname(asset.filename);
        asset.children = [];
        asset.mapping = {};
        asset.dependencies.forEach((relativePath) => {
            let absolutePath = path.join(dirname, relativePath);
            let child = createAsset(absolutePath);
            asset.mapping[relativePath] = child.id;
            asset.children.push(child);
            queue.push(child);
            graph.push(child);
        });

    }

    return graph;
}

function bundle(graph) {

    let modules = '';
    graph.forEach((module) => {
        modules += `${module.id}: [
            function(require, exports, module) {
                ${module.code}
            },
            ${JSON.stringify(module.mapping)}
        ],`

    })

    let result = `
        (function(modules) {
            let installedModules = {};
            function require(id) {
                if(installedModules[id]) {
                    return installedModules[id].exports;
                }
                const [fn, mapping] = modules[id];

                let module = {
                    exports: {}
                };
                installedModules[id] = module;

                function localRequire(relativePath) {
                    return require(mapping[relativePath]);
                }
                fn(localRequire, module.exports, module);
                return module.exports;
            }

            require(0);
        })({${modules}})
    `;

    return result;
}

function minipack(entry) {
    let graph = createGraph(entry);
    let result = bundle(graph);
    return result;
}

exports.minipack = minipack;