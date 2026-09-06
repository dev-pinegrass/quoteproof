// Exact INR arithmetic only. Source extraction and evidence validation must
// happen separately; this calculator never treats document text as instructions.
export function minor(value) {
  if (typeof value !== 'string' || !/^\d+(?:\.\d{1,2})?$/.test(value))
    throw Error('invalid_money');
  const [whole, fraction = ''] = value.split('.');
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
}
export function money(value) {
  if (typeof value !== 'bigint' || value < 0n)
    throw Error('invalid_minor_units');
  return (
    (value / 100n).toString() + '.' + (value % 100n).toString().padStart(2, '0')
  );
}
function positive(value) {
  if (!Number.isSafeInteger(value) || value < 1)
    throw Error('invalid_quantity');
  return BigInt(value);
}
export function normalize(q, requiredQuantity) {
  if (q.currency !== 'INR') throw Error('unsupported_currency');
  if (typeof q.id !== 'string' || !q.id.trim()) throw Error('missing_quote_id');
  const required = positive(requiredQuantity),
    pack = positive(q.unitsPerPack ?? 1),
    moq = positive(q.minimumQuantity ?? 1);
  const packPrice = minor(q.pricePerPack),
    wanted = required > moq ? required : moq;
  const packs = (wanted + pack - 1n) / pack,
    supplied = packs * pack,
    goods = packPrice * packs;
  const freight = q.freight == null ? null : minor(q.freight),
    tax = q.tax == null ? null : minor(q.tax);
  return {
    id: q.id,
    currency: q.currency,
    requiredQuantity: required.toString(),
    suppliedQuantity: supplied.toString(),
    comparableForRequiredQuantity: moq <= required,
    unitPrice: packPrice % pack === 0n ? money(packPrice / pack) : null,
    unitPriceExact: {
      minorUnitsNumerator: packPrice.toString(),
      denominator: pack.toString(),
    },
    goodsTotal: money(goods),
    landedTotal:
      freight === null || tax === null ? null : money(goods + freight + tax),
    missingTerms: [
      ...(freight === null ? ['freight'] : []),
      ...(tax === null ? ['tax'] : []),
    ],
    constraints: [
      ...(moq > required ? ['minimum_order_quantity'] : []),
      ...(supplied > required ? ['extra_units_required'] : []),
    ],
    automaticPurchase: false,
  };
}
export function compare(quotes, requiredQuantity) {
  if (
    !Array.isArray(quotes) ||
    quotes.length < 2 ||
    new Set(quotes.map((q) => q.id)).size !== quotes.length
  )
    throw Error('need_distinct_quotes');
  const rows = quotes.map((q) => normalize(q, requiredQuantity));
  const comparable = rows.filter((q) => q.comparableForRequiredQuantity);
  let lowestLandedQuoteIds = null;
  if (
    comparable.length >= 2 &&
    comparable.every((q) => q.landedTotal !== null)
  ) {
    const lowest = comparable.reduce(
      (a, q) => (minor(q.landedTotal) < a ? minor(q.landedTotal) : a),
      minor(comparable[0].landedTotal),
    );
    lowestLandedQuoteIds = comparable
      .filter((q) => minor(q.landedTotal) === lowest)
      .map((q) => q.id);
  }
  return { rows, lowestLandedQuoteIds, automaticPurchase: false };
}
