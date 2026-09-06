export const samples = [
  'Carton price: INR 1200.00\nUnits per carton: 12\nMinimum quantity: 12\nFreight: not stated\nTax: INR 0.00',
  'Unit price: INR 110.00\nMinimum quantity: 1\nFreight: INR 0.00\nTax: INR 0.00',
  'Unit price: INR 90.00\nMinimum quantity: 100\nFreight: INR 80.00\nTax: INR 0.00',
];
export function lines(text, prefix) {
  let offset = 0;
  return text.split('\n').flatMap((line) => {
    const start = offset + line.indexOf(line.trim());
    offset += line.length + 1;
    return line.trim()
      ? [
          {
            id: prefix + '-L' + start,
            text: line.trim(),
            start,
            end: start + line.trim().length,
          },
        ]
      : [];
  });
}
export function validate(raw, documents) {
  if (!Array.isArray(raw) || raw.length !== documents.length)
    throw Error('Incomplete extracted quote set');
  return documents.map((doc) => {
    const entries = raw.filter((x) => x.id === doc.id);
    if (entries.length !== 1)
      throw Error('Duplicate or missing quote ' + doc.id);
    const q = entries[0],
      evidence = {},
      out = { id: doc.id, currency: 'INR' };
    function field(key, required = false) {
      const value = q[key];
      if (value == null) {
        if (required) throw Error(doc.id + ': missing ' + key);
        out[key] = null;
        return;
      }
      const e = q.evidence?.[key],
        source = doc.lines.find((s) => s.id === e?.sourceId);
      if (
        !source ||
        typeof e?.quote !== 'string' ||
        !e.quote ||
        !source.text.includes(e.quote)
      )
        throw Error(doc.id + ': ungrounded ' + key);
      const patterns = {
        pricePerPack:
          /(?:unit|carton|pack) price:\s*INR\s*(\d+(?:\.\d{1,2})?)\b/i,
        unitsPerPack: /(?:units per (?:carton|pack)):\s*(\d+)\b/i,
        minimumQuantity: /minimum quantity:\s*(\d+)\b/i,
        freight: /freight:\s*INR\s*(\d+(?:\.\d{1,2})?)\b/i,
        tax: /tax:\s*INR\s*(\d+(?:\.\d{1,2})?)\b/i,
      };
      let m = e.quote.match(patterns[key]);
      if (
        key === 'unitsPerPack' &&
        value === 1 &&
        /unit price:\s*INR/i.test(e.quote)
      )
        m = ['', '1'];
      if (!m || Number(m[1]) !== Number(value))
        throw Error(doc.id + ': source does not establish ' + key);
      if (['unitsPerPack', 'minimumQuantity'].includes(key)) {
        if (!Number.isSafeInteger(value) || value < 1)
          throw Error('Invalid quantity');
      } else if (
        typeof value !== 'string' ||
        !/^\d+(?:\.\d{1,2})?$/.test(value)
      )
        throw Error('Invalid monetary field');
      out[key] = value;
      evidence[key] = {
        sourceId: source.id,
        quote: e.quote,
        start: source.start + source.text.indexOf(e.quote),
      };
    }
    field('pricePerPack', true);
    field('unitsPerPack', true);
    field('minimumQuantity', true);
    field('freight');
    field('tax');
    if (q.currency !== 'INR')
      throw Error('Only source-backed INR quotes are supported');
    return { ...out, evidence };
  });
}
export function fixture(documents) {
  return documents.map((d) => {
    const out = { id: d.id, currency: 'INR', evidence: {} };
    for (const [key, pattern] of Object.entries({
      pricePerPack: /(?:unit|carton|pack) price:\s*INR\s*(\d+(?:\.\d{1,2})?)/i,
      unitsPerPack: /units per (?:carton|pack):\s*(\d+)/i,
      minimumQuantity: /minimum quantity:\s*(\d+)/i,
      freight: /freight:\s*INR\s*(\d+(?:\.\d{1,2})?)/i,
      tax: /tax:\s*INR\s*(\d+(?:\.\d{1,2})?)/i,
    })) {
      const line = d.lines.find((l) => pattern.test(l.text));
      if (line) {
        out[key] = ['unitsPerPack', 'minimumQuantity'].includes(key)
          ? Number(line.text.match(pattern)[1])
          : line.text.match(pattern)[1];
        out.evidence[key] = { sourceId: line.id, quote: line.text };
      } else out[key] = null;
    }
    if (out.unitsPerPack == null) {
      const unit = d.lines.find((l) => /^Unit price:/i.test(l.text));
      if (unit) {
        out.unitsPerPack = 1;
        out.evidence.unitsPerPack = { sourceId: unit.id, quote: unit.text };
      }
    }
    return out;
  });
}
