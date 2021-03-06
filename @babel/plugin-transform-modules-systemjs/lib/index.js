"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

function _helperPluginUtils() {
  const data = require("@babel/helper-plugin-utils");

  _helperPluginUtils = function () {
    return data;
  };

  return data;
}

function _helperHoistVariables() {
  const data = _interopRequireDefault(require("@babel/helper-hoist-variables"));

  _helperHoistVariables = function () {
    return data;
  };

  return data;
}

function _core() {
  const data = require("@babel/core");

  _core = function () {
    return data;
  };

  return data;
}

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const buildTemplate = (0, _core().template)(`
  SYSTEM_REGISTER(MODULE_NAME, SOURCES, function (EXPORT_IDENTIFIER, CONTEXT_IDENTIFIER) {
    "use strict";
    BEFORE_BODY;
    return {
      setters: SETTERS,
      execute: function () {
        BODY;
      }
    };
  });
`);
const buildExportAll = (0, _core().template)(`
  for (var KEY in TARGET) {
    if (KEY !== "default" && KEY !== "__esModule") EXPORT_OBJ[KEY] = TARGET[KEY];
  }
`);

function constructExportCall(path, exportIdent, exportNames, exportValues, exportStarTarget) {
  const statements = [];

  if (exportNames.length === 1) {
    statements.push(_core().types.expressionStatement(_core().types.callExpression(exportIdent, [_core().types.stringLiteral(exportNames[0]), exportValues[0]])));
  } else if (!exportStarTarget) {
    const objectProperties = [];

    for (let i = 0; i < exportNames.length; i++) {
      const exportName = exportNames[i];
      const exportValue = exportValues[i];
      objectProperties.push(_core().types.objectProperty(_core().types.identifier(exportName), exportValue));
    }

    statements.push(_core().types.expressionStatement(_core().types.callExpression(exportIdent, [_core().types.objectExpression(objectProperties)])));
  } else {
    const exportObj = path.scope.generateUid("exportObj");
    statements.push(_core().types.variableDeclaration("var", [_core().types.variableDeclarator(_core().types.identifier(exportObj), _core().types.objectExpression([]))]));
    statements.push(buildExportAll({
      KEY: path.scope.generateUidIdentifier("key"),
      EXPORT_OBJ: _core().types.identifier(exportObj),
      TARGET: exportStarTarget
    }));

    for (let i = 0; i < exportNames.length; i++) {
      const exportName = exportNames[i];
      const exportValue = exportValues[i];
      statements.push(_core().types.expressionStatement(_core().types.assignmentExpression("=", _core().types.memberExpression(_core().types.identifier(exportObj), _core().types.identifier(exportName)), exportValue)));
    }

    statements.push(_core().types.expressionStatement(_core().types.callExpression(exportIdent, [_core().types.identifier(exportObj)])));
  }

  return statements;
}

const TYPE_IMPORT = "Import";

var _default = (0, _helperPluginUtils().declare)((api, options) => {
  api.assertVersion(7);
  const {
    systemGlobal = "System"
  } = options;
  const IGNORE_REASSIGNMENT_SYMBOL = Symbol();
  const reassignmentVisitor = {
    "AssignmentExpression|UpdateExpression"(path) {
      if (path.node[IGNORE_REASSIGNMENT_SYMBOL]) return;
      path.node[IGNORE_REASSIGNMENT_SYMBOL] = true;
      const arg = path.get(path.isAssignmentExpression() ? "left" : "argument");

      if (arg.isObjectPattern() || arg.isArrayPattern()) {
        const exprs = [path.node];

        for (const name in arg.getBindingIdentifiers()) {
          if (this.scope.getBinding(name) !== path.scope.getBinding(name)) {
            return;
          }

          const exportedNames = this.exports[name];
          if (!exportedNames) return;

          for (const exportedName of exportedNames) {
            exprs.push(this.buildCall(exportedName, _core().types.identifier(name)).expression);
          }
        }

        path.replaceWith(_core().types.sequenceExpression(exprs));
        return;
      }

      if (!arg.isIdentifier()) return;
      const name = arg.node.name;
      if (this.scope.getBinding(name) !== path.scope.getBinding(name)) return;
      const exportedNames = this.exports[name];
      if (!exportedNames) return;
      let node = path.node;
      const isPostUpdateExpression = path.isUpdateExpression({
        prefix: false
      });

      if (isPostUpdateExpression) {
        node = _core().types.binaryExpression(node.operator[0], _core().types.unaryExpression("+", _core().types.cloneNode(node.argument)), _core().types.numericLiteral(1));
      }

      for (const exportedName of exportedNames) {
        node = this.buildCall(exportedName, node).expression;
      }

      if (isPostUpdateExpression) {
        node = _core().types.sequenceExpression([node, path.node]);
      }

      path.replaceWith(node);
    }

  };
  return {
    name: "transform-modules-systemjs",
    visitor: {
      CallExpression(path, state) {
        if (path.node.callee.type === TYPE_IMPORT) {
          path.replaceWith(_core().types.callExpression(_core().types.memberExpression(_core().types.identifier(state.contextIdent), _core().types.identifier("import")), path.node.arguments));
        }
      },

      MetaProperty(path, state) {
        if (path.node.meta.name === "import" && path.node.property.name === "meta") {
          path.replaceWith(_core().types.memberExpression(_core().types.identifier(state.contextIdent), _core().types.identifier("meta")));
        }
      },

      ReferencedIdentifier(path, state) {
        if (path.node.name == "__moduleName" && !path.scope.hasBinding("__moduleName")) {
          path.replaceWith(_core().types.memberExpression(_core().types.identifier(state.contextIdent), _core().types.identifier("id")));
        }
      },

      Program: {
        enter(path, state) {
          state.contextIdent = path.scope.generateUid("context");
        },

        exit(path, state) {
          const exportIdent = path.scope.generateUid("export");
          const contextIdent = state.contextIdent;
          const exportNames = Object.create(null);
          const modules = [];
          let beforeBody = [];
          const setters = [];
          const sources = [];
          const variableIds = [];
          const removedPaths = [];

          function addExportName(key, val) {
            exportNames[key] = exportNames[key] || [];
            exportNames[key].push(val);
          }

          function pushModule(source, key, specifiers) {
            let module;
            modules.forEach(function (m) {
              if (m.key === source) {
                module = m;
              }
            });

            if (!module) {
              modules.push(module = {
                key: source,
                imports: [],
                exports: []
              });
            }

            module[key] = module[key].concat(specifiers);
          }

          function buildExportCall(name, val) {
            return _core().types.expressionStatement(_core().types.callExpression(_core().types.identifier(exportIdent), [_core().types.stringLiteral(name), val]));
          }

          const body = path.get("body");

          for (const path of body) {
            if (path.isFunctionDeclaration()) {
              beforeBody.push(path.node);
              removedPaths.push(path);
            } else if (path.isImportDeclaration()) {
              const source = path.node.source.value;
              pushModule(source, "imports", path.node.specifiers);

              for (const name in path.getBindingIdentifiers()) {
                path.scope.removeBinding(name);
                variableIds.push(_core().types.identifier(name));
              }

              path.remove();
            } else if (path.isExportAllDeclaration()) {
              pushModule(path.node.source.value, "exports", path.node);
              path.remove();
            } else if (path.isExportDefaultDeclaration()) {
              const declar = path.get("declaration");

              if (declar.isClassDeclaration() || declar.isFunctionDeclaration()) {
                const id = declar.node.id;
                const nodes = [];

                if (id) {
                  nodes.push(declar.node);
                  nodes.push(buildExportCall("default", _core().types.cloneNode(id)));
                  addExportName(id.name, "default");
                } else {
                  nodes.push(buildExportCall("default", _core().types.toExpression(declar.node)));
                }

                if (declar.isClassDeclaration()) {
                  path.replaceWithMultiple(nodes);
                } else {
                  beforeBody = beforeBody.concat(nodes);
                  removedPaths.push(path);
                }
              } else {
                path.replaceWith(buildExportCall("default", declar.node));
              }
            } else if (path.isExportNamedDeclaration()) {
              const declar = path.get("declaration");

              if (declar.node) {
                path.replaceWith(declar);

                if (path.isFunction()) {
                  const node = declar.node;
                  const name = node.id.name;
                  addExportName(name, name);
                  beforeBody.push(node);
                  beforeBody.push(buildExportCall(name, _core().types.cloneNode(node.id)));
                  removedPaths.push(path);
                } else if (path.isClass()) {
                  const name = declar.node.id.name;
                  addExportName(name, name);
                  path.insertAfter([buildExportCall(name, _core().types.identifier(name))]);
                } else {
                  for (const name in declar.getBindingIdentifiers()) {
                    addExportName(name, name);
                  }
                }
              } else {
                const specifiers = path.node.specifiers;

                if (specifiers && specifiers.length) {
                  if (path.node.source) {
                    pushModule(path.node.source.value, "exports", specifiers);
                    path.remove();
                  } else {
                    const nodes = [];

                    for (const specifier of specifiers) {
                      const binding = path.scope.getBinding(specifier.local.name);

                      if (binding && _core().types.isFunctionDeclaration(binding.path.node)) {
                        beforeBody.push(buildExportCall(specifier.exported.name, _core().types.cloneNode(specifier.local)));
                      } else if (!binding) {
                          nodes.push(buildExportCall(specifier.exported.name, specifier.local));
                        }

                      addExportName(specifier.local.name, specifier.exported.name);
                    }

                    path.replaceWithMultiple(nodes);
                  }
                }
              }
            }
          }

          modules.forEach(function (specifiers) {
            let setterBody = [];
            const target = path.scope.generateUid(specifiers.key);

            for (let specifier of specifiers.imports) {
              if (_core().types.isImportNamespaceSpecifier(specifier)) {
                setterBody.push(_core().types.expressionStatement(_core().types.assignmentExpression("=", specifier.local, _core().types.identifier(target))));
              } else if (_core().types.isImportDefaultSpecifier(specifier)) {
                specifier = _core().types.importSpecifier(specifier.local, _core().types.identifier("default"));
              }

              if (_core().types.isImportSpecifier(specifier)) {
                setterBody.push(_core().types.expressionStatement(_core().types.assignmentExpression("=", specifier.local, _core().types.memberExpression(_core().types.identifier(target), specifier.imported))));
              }
            }

            if (specifiers.exports.length) {
              const exportNames = [];
              const exportValues = [];
              let hasExportStar = false;

              for (const node of specifiers.exports) {
                if (_core().types.isExportAllDeclaration(node)) {
                  hasExportStar = true;
                } else if (_core().types.isExportSpecifier(node)) {
                  exportNames.push(node.exported.name);
                  exportValues.push(_core().types.memberExpression(_core().types.identifier(target), node.local));
                } else {}
              }

              setterBody = setterBody.concat(constructExportCall(path, _core().types.identifier(exportIdent), exportNames, exportValues, hasExportStar ? _core().types.identifier(target) : null));
            }

            sources.push(_core().types.stringLiteral(specifiers.key));
            setters.push(_core().types.functionExpression(null, [_core().types.identifier(target)], _core().types.blockStatement(setterBody)));
          });
          let moduleName = this.getModuleName();
          if (moduleName) moduleName = _core().types.stringLiteral(moduleName);
          const uninitializedVars = [];
          (0, _helperHoistVariables().default)(path, (id, name, hasInit) => {
            variableIds.push(id);

            if (!hasInit) {
              uninitializedVars.push(name);
            }
          }, null);

          if (variableIds.length) {
            beforeBody.unshift(_core().types.variableDeclaration("var", variableIds.map(id => _core().types.variableDeclarator(id))));
          }

          if (uninitializedVars.length) {
            const undefinedValues = [];
            const undefinedIdent = path.scope.buildUndefinedNode();

            for (let i = 0; i < uninitializedVars.length; i++) {
              undefinedValues[i] = undefinedIdent;
            }

            beforeBody = beforeBody.concat(constructExportCall(path, _core().types.identifier(exportIdent), uninitializedVars, undefinedValues, null));
          }

          path.traverse(reassignmentVisitor, {
            exports: exportNames,
            buildCall: buildExportCall,
            scope: path.scope
          });

          for (const path of removedPaths) {
            path.remove();
          }

          path.node.body = [buildTemplate({
            SYSTEM_REGISTER: _core().types.memberExpression(_core().types.identifier(systemGlobal), _core().types.identifier("register")),
            BEFORE_BODY: beforeBody,
            MODULE_NAME: moduleName,
            SETTERS: _core().types.arrayExpression(setters),
            SOURCES: _core().types.arrayExpression(sources),
            BODY: path.node.body,
            EXPORT_IDENTIFIER: _core().types.identifier(exportIdent),
            CONTEXT_IDENTIFIER: _core().types.identifier(contextIdent)
          })];
        }

      }
    }
  };
});

exports.default = _default;