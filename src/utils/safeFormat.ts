/**
 * Safe string & error formatting utilities to prevent "[object Object]" coercion
 * across API error responses, OCR/JSON extraction, and UI rendering.
 */

function isObjectObjectString(s: string): boolean {
  return s.trim().toLowerCase() === '[object object]';
}

export function toSafeString(val: unknown): string {
  if (val === null || val === undefined) return '';

  if (typeof val === 'string') {
    return isObjectObjectString(val) ? '' : val;
  }

  if (typeof val === 'number' || typeof val === 'boolean' || typeof val === 'bigint') {
    return String(val);
  }

  if (val instanceof Date) {
    return isNaN(val.getTime()) ? '' : val.toISOString();
  }

  if (Array.isArray(val)) {
    return val
      .map((item) => toSafeString(item).trim())
      .filter(Boolean)
      .join(', ');
  }

  if (typeof val === 'object') {
    const obj = val as Record<string, unknown>;

    // Handle ITR JSON name objects
    if ('FirstName' in obj || 'MiddleName' in obj || 'SurNameOrOrgName' in obj) {
      const nameParts = [obj.FirstName, obj.MiddleName, obj.SurNameOrOrgName]
        .map((p) => toSafeString(p).trim())
        .filter(Boolean);
      if (nameParts.length > 0) return nameParts.join(' ');
    }

    // Handle ITR JSON address objects
    if (
      'ResidenceNo' in obj ||
      'PremiseName' in obj ||
      'RoadOrStreet' in obj ||
      'AreaOrLocality' in obj ||
      'CityOrTownOrDistrict' in obj
    ) {
      const addrParts = [
        obj.ResidenceNo,
        obj.PremiseName,
        obj.RoadOrStreet,
        obj.AreaOrLocality,
        obj.CityOrTownOrDistrict,
        obj.PinCode,
      ]
        .map((p) => toSafeString(p).trim())
        .filter(Boolean);
      if (addrParts.length > 0) return addrParts.join(', ');
    }

    const preferredKeys = [
      'message',
      'error',
      'value',
      'name',
      'label',
      'text',
      'bankName',
      'BankName',
      'description',
      'details',
      'title',
    ];
    for (const key of preferredKeys) {
      if (key in obj && obj[key] !== undefined && obj[key] !== null) {
        const extracted = toSafeString(obj[key]).trim();
        if (extracted) return extracted;
      }
    }

    try {
      const json = JSON.stringify(obj);
      if (json && json !== '{}' && json !== '[]') {
        return json;
      }
    } catch {
      // Ignore circular reference errors
    }
    return '';
  }

  return '';
}

export function getReadableErrorMessage(
  err: unknown,
  fallback: string = 'An unexpected error occurred.'
): string {
  if (err === null || err === undefined) return fallback;

  if (typeof err === 'string') {
    const trimmed = err.trim();
    if (!trimmed || isObjectObjectString(trimmed)) return fallback;
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const parsed = JSON.parse(trimmed);
        return getReadableErrorMessage(parsed, fallback);
      } catch {
        // Not valid JSON, return raw string
      }
    }
    return trimmed;
  }

  if (err instanceof Error) {
    const msg = typeof err.message === 'string' ? err.message.trim() : toSafeString(err.message).trim();
    if (msg && !isObjectObjectString(msg)) {
      if (msg.startsWith('{') && msg.endsWith('}')) {
        try {
          const parsed = JSON.parse(msg);
          return getReadableErrorMessage(parsed, fallback);
        } catch {
          return msg;
        }
      }
      return msg;
    }
    const extra = (err as any).error ?? (err as any).cause ?? (err as any).details;
    if (extra) {
      return getReadableErrorMessage(extra, fallback);
    }
    return fallback;
  }

  if (typeof err === 'object') {
    const obj = err as Record<string, unknown>;
    for (const key of ['error', 'message', 'detail', 'details', 'statusText', 'reason']) {
      if (key in obj && obj[key] !== undefined && obj[key] !== null) {
        const candidate = getReadableErrorMessage(obj[key], '');
        if (candidate) return candidate;
      }
    }
    try {
      const json = JSON.stringify(obj);
      if (json && json !== '{}' && json !== '[]') {
        return json;
      }
    } catch {
      // Ignore circular reference
    }
    return fallback;
  }

  const str = toSafeString(err).trim();
  return str || fallback;
}
