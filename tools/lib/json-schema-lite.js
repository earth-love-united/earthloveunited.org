'use strict';

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]));
}

function same(left, right) {
  return JSON.stringify(stable(left)) === JSON.stringify(stable(right));
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

function validateJsonSchema(value, schema, root = schema, at = '$') {
  if (!schema || typeof schema !== 'object') return [`${at}: schema missing`];
  if (schema.$ref) {
    const target = resolveRef(root, schema.$ref);
    return target ? validateJsonSchema(value, target, root, at) : [`${at}: unresolved schema reference ${schema.$ref}`];
  }

  const errors = [];
  const allowedTypes = Array.isArray(schema.type) ? schema.type : schema.type ? [schema.type] : [];
  if (allowedTypes.length && !allowedTypes.some(type => typeMatches(value, type))) {
    return [`${at}: expected ${allowedTypes.join('|')}`];
  }
  if (Object.hasOwn(schema, 'const') && !same(value, schema.const)) errors.push(`${at}: const mismatch`);
  if (Array.isArray(schema.enum) && !schema.enum.some(item => same(value, item))) errors.push(`${at}: enum mismatch`);

  if (typeof value === 'string') {
    if (Number.isInteger(schema.minLength) && value.length < schema.minLength) errors.push(`${at}: shorter than minLength`);
    if (schema.pattern && !(new RegExp(schema.pattern).test(value))) errors.push(`${at}: pattern mismatch`);
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

  if (Array.isArray(value)) {
    if (Number.isInteger(schema.minItems) && value.length < schema.minItems) errors.push(`${at}: fewer than minItems`);
    if (Number.isInteger(schema.maxItems) && value.length > schema.maxItems) errors.push(`${at}: more than maxItems`);
    if (schema.uniqueItems === true && new Set(value.map(item => JSON.stringify(stable(item)))).size !== value.length) {
      errors.push(`${at}: duplicate items`);
    }
    if (schema.items && typeof schema.items === 'object') {
      value.forEach((item, index) => errors.push(...validateJsonSchema(item, schema.items, root, `${at}[${index}]`)));
    }
  }

  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const key of schema.required || []) {
      if (!Object.hasOwn(value, key)) errors.push(`${at}.${key}: required`);
    }
    const properties = schema.properties || {};
    for (const [key, child] of Object.entries(value)) {
      if (properties[key]) errors.push(...validateJsonSchema(child, properties[key], root, `${at}.${key}`));
      else if (schema.additionalProperties === false) errors.push(`${at}.${key}: additional property`);
    }
  }
  return errors;
}

module.exports = { same, stable, validateJsonSchema };
