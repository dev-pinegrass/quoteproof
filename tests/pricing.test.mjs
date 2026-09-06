import test from 'node:test';
import assert from 'node:assert/strict';
import {normalize,compare,minor,money} from '../lib/pricing.mjs';
const quote=(id,price,extra={})=>({id,currency:'INR',pricePerPack:price,freight:'0.00',tax:'0.00',...extra});
test('QUOTE-01: carton and unit prices normalize without rounding',()=>{
 const r=compare([quote('a','1200.00',{unitsPerPack:12}),quote('b','110.00')],12);
 assert.equal(r.rows[0].unitPrice,'100.00'); assert.equal(r.rows[1].unitPrice,'110.00');
 assert.deepEqual(r.lowestLandedQuoteIds,['a']);
});
test('QUOTE-02: unknown freight cannot silently become zero',()=>{
 const r=compare([quote('a','1000.00',{freight:null}),quote('b','1050.00')],1);
 assert.equal(r.lowestLandedQuoteIds,null); assert.deepEqual(r.rows[0].missingTerms,['freight']);
});
test('QUOTE-03: decimal multiplication is exact',()=>assert.equal(normalize(quote('a','0.10'),3).goodsTotal,'0.30'));
test('QUOTE-05: MOQ exposes minimum spend and excludes exact-quantity comparison',()=>{
 const r=normalize(quote('e','90.00',{minimumQuantity:100}),10);
 assert.equal(r.goodsTotal,'9000.00'); assert.equal(r.comparableForRequiredQuantity,false);
 assert.ok(r.constraints.includes('minimum_order_quantity'));
});
test('fractional minor-unit unit prices retain an exact ratio',()=>{
 const r=normalize(quote('a','1.00',{unitsPerPack:3}),3);
 assert.equal(r.unitPrice,null); assert.deepEqual(r.unitPriceExact,{minorUnitsNumerator:'100',denominator:'3'});
 assert.equal(r.goodsTotal,'1.00');
});
test('invalid money, mixed currency and missing taxes are rejected or unresolved',()=>{
 assert.throws(()=>minor('0.001'),/invalid_money/); assert.throws(()=>minor('-1'),/invalid_money/);
 assert.throws(()=>normalize(quote('a','1',{currency:'USD'}),1),/unsupported_currency/);
 assert.equal(normalize(quote('a','1',{tax:null}),1).landedTotal,null);
 assert.equal(money(minor('9007199254740993.01')),'9007199254740993.01');
});
