import test from 'node:test';
import assert from 'node:assert/strict';
import {transfer, positiveInt, salaryAmount, dhakaDay} from '../src/domain.js';
test('gift conserves coins and credits receiver',()=> assert.deepEqual(transfer(100,20,10,3),{sender:70,receiver:50,cost:30}));
test('overdraw and invalid gift amounts fail',()=> { for(const n of [-1,0,0.2,NaN,Infinity,100]) assert.throws(()=>transfer(100,0,10,n)); assert.throws(()=>transfer(2,0,10,1)); });
test('salary requires verified daily target',()=> { assert.equal(salaryAmount(1000,1000,12500),12500); assert.throws(()=>salaryAmount(999,1000,12500)); });
test('money uses integer units',()=> {assert.throws(()=>positiveInt(1.25)); assert.equal(positiveInt(12500),12500);});
test('salary resets at Dhaka midnight',()=> {assert.equal(dhakaDay(new Date('2026-11-07T17:59:59Z')),'2026-11-07');assert.equal(dhakaDay(new Date('2026-11-07T18:00:00Z')),'2026-11-08');});
