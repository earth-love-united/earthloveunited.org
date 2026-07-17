'use strict';

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]));
}

function same(left, right) {
  return JSON.stringify(stable(left)) === JSON.stringify(stable(right));
}

function canonicalJsonText(value) {
  return JSON.stringify(stable(value), null, 2) + '\n';
}

function parseJsonNoDuplicateKeys(input, label = 'JSON') {
  if (typeof input !== 'string') throw new Error(label + ' input must be UTF-8 text');
  let cursor = 0;

  function fail(message) {
    throw new Error(label + ' ' + message + ' at byte ' + Buffer.byteLength(input.slice(0, cursor), 'utf8'));
  }

  function whitespace() {
    while (cursor < input.length && /[\x20\x09\x0a\x0d]/.test(input[cursor])) cursor += 1;
  }

  function stringValue() {
    if (input[cursor] !== '"') fail('expected string');
    const start = cursor;
    cursor += 1;
    while (cursor < input.length) {
      const code = input.charCodeAt(cursor);
      if (input[cursor] === '"') {
        cursor += 1;
        try { return JSON.parse(input.slice(start, cursor)); }
        catch (_) { fail('contains an invalid string'); }
      }
      if (input[cursor] === '\\') {
        cursor += 1;
        if (cursor >= input.length || !/["\\/bfnrtu]/.test(input[cursor])) {
          fail('contains an invalid string escape');
        }
        if (input[cursor] === 'u') {
          if (!/^[0-9a-fA-F]{4}$/.test(input.slice(cursor + 1, cursor + 5))) {
            fail('contains an invalid Unicode escape');
          }
          cursor += 5;
        } else {
          cursor += 1;
        }
        continue;
      }
      if (code <= 0x1f) fail('contains an unescaped control character');
      cursor += 1;
    }
    fail('contains an unterminated string');
  }

  function value() {
    whitespace();
    if (cursor >= input.length) fail('ended before a value');
    if (input[cursor] === '{') {
      cursor += 1;
      whitespace();
      const keys = new Set();
      if (input[cursor] === '}') {
        cursor += 1;
        return;
      }
      while (cursor < input.length) {
        const key = stringValue();
        if (keys.has(key)) fail('contains duplicate object member ' + JSON.stringify(key));
        keys.add(key);
        whitespace();
        if (input[cursor] !== ':') fail('expected colon after object member');
        cursor += 1;
        value();
        whitespace();
        if (input[cursor] === '}') {
          cursor += 1;
          return;
        }
        if (input[cursor] !== ',') fail('expected comma between object members');
        cursor += 1;
        whitespace();
      }
      fail('contains an unterminated object');
    }
    if (input[cursor] === '[') {
      cursor += 1;
      whitespace();
      if (input[cursor] === ']') {
        cursor += 1;
        return;
      }
      while (cursor < input.length) {
        value();
        whitespace();
        if (input[cursor] === ']') {
          cursor += 1;
          return;
        }
        if (input[cursor] !== ',') fail('expected comma between array entries');
        cursor += 1;
      }
      fail('contains an unterminated array');
    }
    if (input[cursor] === '"') {
      stringValue();
      return;
    }
    const literal = /^(?:true|false|null)/.exec(input.slice(cursor));
    if (literal) {
      cursor += literal[0].length;
      return;
    }
    const number = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(input.slice(cursor));
    if (number) {
      cursor += number[0].length;
      return;
    }
    fail('contains an invalid value');
  }

  whitespace();
  value();
  whitespace();
  if (cursor !== input.length) fail('contains trailing content');
  return JSON.parse(input);
}

function resolveRef(root, reference) {
  if (typeof reference !== 'string' || !reference.startsWith('#/')) return null;
  return reference.slice(2).split('/').reduce((node, part) => {
    const key = part.replace(/~1/g, '/').replace(/~0/g, '~');
    return node && node[key];
  }, root);
}

function typeMatches(value, type) {
  if (type === 'null') return value === null;
  if (type === 'array') return Array.isArray(value);
  if (type === 'object') return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  if (type === 'integer') return Number.isInteger(value);
  if (type === 'number') return typeof value === 'number' && Number.isFinite(value);
  return typeof value === type;
}

const SUPPORTED_SCHEMA_KEYWORDS = new Set([
  '$schema', '$id', '$ref', '$defs', 'title', 'description',
  'type', 'const', 'enum', 'allOf', 'oneOf', 'not', 'if', 'then', 'else',
  'minLength', 'maxLength', 'pattern', 'format',
  'minimum', 'maximum',
  'minItems', 'maxItems', 'uniqueItems', 'prefixItems', 'items',
  'required', 'properties', 'additionalProperties',
]);

function auditSchemaDefinition(schema, at = '$schema') {
  if (schema === true || schema === false) return [];
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) {
    return [`${at}: schema definition must be an object or boolean`];
  }
  const errors = [];
  Object.keys(schema).forEach(key => {
    if (!SUPPORTED_SCHEMA_KEYWORDS.has(key)) errors.push(`${at}: unsupported schema keyword ${key}`);
  });
  if (Object.hasOwn(schema, 'format') && schema.format !== 'date-time') {
    errors.push(`${at}: unsupported schema format ${String(schema.format)}`);
  }
  const mapChildren = ['$defs', 'properties'];
  mapChildren.forEach(key => {
    if (!Object.hasOwn(schema, key)) return;
    const value = schema[key];
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      errors.push(`${at}.${key}: expected schema map`);
      return;
    }
    Object.entries(value).forEach(([name, child]) => {
      errors.push(...auditSchemaDefinition(child, `${at}.${key}.${name}`));
    });
  });
  ['allOf', 'oneOf', 'prefixItems'].forEach(key => {
    if (!Object.hasOwn(schema, key)) return;
    if (!Array.isArray(schema[key])) {
      errors.push(`${at}.${key}: expected schema array`);
      return;
    }
    schema[key].forEach((child, index) => {
      errors.push(...auditSchemaDefinition(child, `${at}.${key}[${index}]`));
    });
  });
  ['not', 'if', 'then', 'else', 'items', 'additionalProperties'].forEach(key => {
    if (!Object.hasOwn(schema, key) || (key === 'additionalProperties' && typeof schema[key] === 'boolean')) return;
    errors.push(...auditSchemaDefinition(schema[key], `${at}.${key}`));
  });
  return errors;
}

function validateJsonSchema(value, schema, root = schema, at = '$', definitionChecked = false) {
  if (!definitionChecked) {
    const definitionErrors = auditSchemaDefinition(root);
    if (definitionErrors.length) return definitionErrors;
  }
  if (schema === true) return [];
  if (schema === false) return [`${at}: disallowed by schema`];
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) return [`${at}: schema missing`];
  if (schema.$ref) {
    const target = resolveRef(root, schema.$ref);
    if (!target) return [`${at}: unresolved schema reference ${schema.$ref}`];
    const referenced = validateJsonSchema(value, target, root, at, true);
    const siblings = Object.fromEntries(Object.entries(schema).filter(([key]) => key !== '$ref'));
    return Object.keys(siblings).length
      ? referenced.concat(validateJsonSchema(value, siblings, root, at, true))
      : referenced;
  }

  const errors = [];
  const allowedTypes = Array.isArray(schema.type) ? schema.type : schema.type ? [schema.type] : [];
  if (allowedTypes.length && !allowedTypes.some(type => typeMatches(value, type))) {
    return [`${at}: expected ${allowedTypes.join('|')}`];
  }
  if (Object.hasOwn(schema, 'const') && !same(value, schema.const)) errors.push(`${at}: const mismatch`);
  if (Array.isArray(schema.enum) && !schema.enum.some(item => same(value, item))) errors.push(`${at}: enum mismatch`);
  if (Array.isArray(schema.allOf)) {
    schema.allOf.forEach(child => errors.push(...validateJsonSchema(value, child, root, at, true)));
  }
  if (Array.isArray(schema.oneOf)) {
    const matches = schema.oneOf.filter(child => validateJsonSchema(value, child, root, at, true).length === 0).length;
    if (matches !== 1) errors.push(`${at}: expected exactly one oneOf match`);
  }
  if (Object.hasOwn(schema, 'not') &&
      validateJsonSchema(value, schema.not, root, at, true).length === 0) {
    errors.push(`${at}: matched forbidden schema`);
  }
  if (Object.hasOwn(schema, 'if')) {
    const conditionMatched = validateJsonSchema(value, schema.if, root, at, true).length === 0;
    if (conditionMatched && Object.hasOwn(schema, 'then')) {
      errors.push(...validateJsonSchema(value, schema.then, root, at, true));
    } else if (!conditionMatched && Object.hasOwn(schema, 'else')) {
      errors.push(...validateJsonSchema(value, schema.else, root, at, true));
    }
  }

  if (typeof value === 'string') {
    const length = [...value].length;
    if (Number.isInteger(schema.minLength) && length < schema.minLength) errors.push(`${at}: shorter than minLength`);
    if (Number.isInteger(schema.maxLength) && length > schema.maxLength) errors.push(`${at}: longer than maxLength`);
    if (schema.pattern) {
      try {
        if (!(new RegExp(schema.pattern).test(value))) errors.push(`${at}: pattern mismatch`);
      } catch (_) { errors.push(`${at}: schema pattern is invalid`); }
    }
    if (schema.format === 'date-time') {
      const timestamp = new Date(value);
      if (Number.isNaN(timestamp.getTime()) || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)) {
        errors.push(`${at}: invalid UTC date-time`);
      }
    }
  }

  if (typeof value === 'number' && Number.isFinite(schema.minimum) && value < schema.minimum) {
    errors.push(`${at}: below minimum`);
  }
  if (typeof value === 'number' && Number.isFinite(schema.maximum) && value > schema.maximum) {
    errors.push(`${at}: above maximum`);
  }

  if (Array.isArray(value)) {
    if (Number.isInteger(schema.minItems) && value.length < schema.minItems) errors.push(`${at}: fewer than minItems`);
    if (Number.isInteger(schema.maxItems) && value.length > schema.maxItems) errors.push(`${at}: more than maxItems`);
    if (schema.uniqueItems === true && new Set(value.map(item => JSON.stringify(stable(item)))).size !== value.length) {
      errors.push(`${at}: duplicate items`);
    }
    const prefixLength = Array.isArray(schema.prefixItems) ? schema.prefixItems.length : 0;
    if (Array.isArray(schema.prefixItems)) {
      schema.prefixItems.forEach((child, index) => {
        if (index < value.length) {
          errors.push(...validateJsonSchema(value[index], child, root, `${at}[${index}]`, true));
        }
      });
    }
    if (Object.hasOwn(schema, 'items')) {
      const start = prefixLength;
      for (let index = start; index < value.length; index += 1) {
        errors.push(...validateJsonSchema(value[index], schema.items, root, `${at}[${index}]`, true));
      }
    }
  }

  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const key of schema.required || []) {
      if (!Object.hasOwn(value, key)) errors.push(`${at}.${key}: required`);
    }
    const properties = schema.properties || {};
    for (const [key, child] of Object.entries(value)) {
      if (Object.hasOwn(properties, key)) {
        errors.push(...validateJsonSchema(child, properties[key], root, `${at}.${key}`, true));
      }
      else if (schema.additionalProperties === false) errors.push(`${at}.${key}: additional property`);
      else if (schema.additionalProperties && typeof schema.additionalProperties === 'object') {
        errors.push(...validateJsonSchema(child, schema.additionalProperties, root, `${at}.${key}`, true));
      }
    }
  }
  return errors;
}

module.exports = {
  auditSchemaDefinition,
  canonicalJsonText,
  parseJsonNoDuplicateKeys,
  same,
  stable,
  validateJsonSchema,
};
