module.exports = {
    "root": true,
    "env": {
        "node": true,
    },
    "parserOptions": {
        "ecmaVersion": "2017"
    },
    rules: {
        // syntax preferences
	    "indent": ["error", 2],
	    "semi": "error",
        "prefer-const": 2,
        "new-parens": 2,
        "func-call-spacing": 2,
        "eqeqeq": [2],
        "spaced-comment": [2, "always", {
            "markers": ["*"]
        }],
        "quotes": [2, "single", {
            "avoidEscape": true,
            "allowTemplateLiterals": true
        }],
        // anti-patterns
        "no-var": 2,
        "no-with": 2,
        "no-multi-str": 2,
        "no-caller": 2,
        "no-implied-eval": 2,
        "no-labels": 2,
        "no-new-object": 2,
        "no-octal-escape": 2,
        "no-self-compare": 2,
        "no-shadow-restricted-names": 2,
        "no-cond-assign": 2,
        "no-debugger": 2,
        "no-dupe-keys": 2,
        "no-duplicate-case": 2,
        "no-empty-character-class": 2,
        "no-unreachable": 2,
        "no-unsafe-negation": 2,
        "radix": 2,
        "valid-typeof": 2,
        "no-unused-vars": [2, { "args": "none", "vars": "local", "varsIgnorePattern": "([fx]?describe|[fx]?it|beforeAll|beforeEach|afterAll|afterEach)" }],
        "no-implicit-globals": [2],
	}
}
