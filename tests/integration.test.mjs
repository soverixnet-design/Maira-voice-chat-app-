import {before,after,beforeEach,test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {initializeTestEnvironment,assertFails,assertSucceeds} from '@firebase/rules-unit-testing';
import {doc,getDoc,setDoc} from 'firebase/firestore';
import {getFirestore} from 'firebase-admin/firestore';
import {api} from '../functions/src/index.js';
let env;
const db=getFirestore();
const call=(uid,action,data={},admin=false)=>api.run({auth:{uid,token:{admin}},data:{action,...data}});
before(async()=>{env=await initializeTestEnvironment({projectId:'demo-maira-voice',firestore:{host:'127.0.0.1',port:8080,rules:await readFile('firestore.rules','utf8')}});});
after(async()=>{await env?.cleanup();await db.terminate();});
beforeEach(async()=>{
 await env.clearFirestore();
 const batch=db.batch();
 for(const uid of ['alice','bob','admin']){batch.set(db.doc(`users/${uid}`),{uid,name:uid,banned:false,agencyId:uid==='bob'?'bd':null});batch.set(db.doc(`wallets/${uid}`),{coins:100,diamonds:0,salaryPaisa:20000});}
 batch.set(db.doc('agencies/bd'),{name:'BD',active:true,ownerUid:'admin'});
 batch.set(db.doc('rooms/alice'),{title:'Test',hostId:'alice',active:true,speakers:['alice']});
 for(const uid of ['alice','bob'])batch.set(db.doc(`rooms/alice/members/${uid}`),{uid,active:true,blocked:false});
 batch.set(db.doc('gifts/rose'),{name:'Rose',price:10,active:true});
 batch.set(db.doc('settings/economy'),{minimumDiamonds:100,dailySalaryPaisa:10000,minimumWithdrawalPaisa:10000,withdrawalsEnabled:true});
 await batch.commit();
});
test('unauthenticated and non-admin administrative calls fail',async()=>{
 await assert.rejects(api.run({data:{action:'seed'}}),e=>e.code==='unauthenticated');
 await assert.rejects(call('alice','creditCoins',{uid:'alice',coins:100,paymentReference:'fake123'}),e=>e.code==='permission-denied');
});
test('wallet reads are private and all client writes are denied',async()=>{
 const alice=env.authenticatedContext('alice').firestore(),admin=env.authenticatedContext('admin',{admin:true}).firestore();
 await assertSucceeds(getDoc(doc(alice,'wallets/alice')));
 await assertFails(getDoc(doc(alice,'wallets/bob')));
 await assertFails(setDoc(doc(alice,'wallets/alice'),{coins:999999}));
 await assertFails(setDoc(doc(admin,'wallets/alice'),{coins:999999}));
 await assertSucceeds(getDoc(doc(admin,'wallets/bob')));
 await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(),'rooms/alice')));
});
test('concurrent duplicate gifts debit and credit exactly once',async()=>{
 const payload={roomId:'alice',giftId:'rose',toUid:'bob',quantity:2,requestId:randomUUID()};
 await Promise.all([call('alice','gift',payload),call('alice','gift',payload)]);
 assert.equal((await db.doc('wallets/alice').get()).data().coins,80);
 assert.equal((await db.doc('wallets/bob').get()).data().diamonds,20);
 assert.equal((await db.collection('ledger').get()).size,1);
});
test('concurrent different gifts cannot overdraw',async()=>{
 const results=await Promise.allSettled([1,2].map(()=>call('alice','gift',{roomId:'alice',giftId:'rose',toUid:'bob',quantity:8,requestId:randomUUID()})));
 assert.equal(results.filter(x=>x.status==='fulfilled').length,1);
 assert.equal((await db.doc('wallets/alice').get()).data().coins,20);
});
test('blocked room members cannot send gifts',async()=>{
 await db.doc('rooms/alice/members/alice').update({blocked:true});
 await assert.rejects(call('alice','gift',{roomId:'alice',giftId:'rose',toUid:'bob',quantity:1,requestId:randomUUID()}));
 assert.equal((await db.doc('wallets/alice').get()).data().coins,100);
});
test('payment references cannot be reused',async()=>{
 await call('admin','creditCoins',{uid:'alice',coins:50,paymentReference:'payment123'},true);
 await assert.rejects(call('admin','creditCoins',{uid:'alice',coins:50,paymentReference:'payment123'},true));
 assert.equal((await db.doc('wallets/alice').get()).data().coins,150);
});
test('salary has one approval per host per completed day',async()=>{
 await db.doc('daily/2020-01-01_bob').set({diamonds:100,uid:'bob'});
 const outcomes=await Promise.allSettled([1,2].map(()=>call('admin','approveSalary',{uid:'bob',day:'2020-01-01'},true)));
 assert.equal(outcomes.filter(x=>x.status==='fulfilled').length,1);
 assert.equal((await db.doc('wallets/bob').get()).data().salaryPaisa,30000);
});
test('salary rejects target shortfall and non-agency hosts',async()=>{
 await db.doc('daily/2020-01-01_bob').set({diamonds:99});
 await db.doc('daily/2020-01-01_alice').set({diamonds:200});
 await assert.rejects(call('admin','approveSalary',{uid:'bob',day:'2020-01-01'},true));
 await assert.rejects(call('admin','approveSalary',{uid:'alice',day:'2020-01-01'},true));
});
test('withdrawal retry reserves once and rejection refunds once',async()=>{
 const requestId=randomUUID(),payload={requestId,amountPaisa:10000,method:'bKash',account:'01700000000'};
 await Promise.all([call('bob','withdraw',payload),call('bob','withdraw',payload)]);
 assert.equal((await db.doc('wallets/bob').get()).data().salaryPaisa,10000);
 const review={id:`bob_${requestId}`,status:'rejected',reference:'Invalid account'};
 await call('admin','reviewWithdrawal',review,true);
 await assert.rejects(call('admin','reviewWithdrawal',review,true));
 assert.equal((await db.doc('wallets/bob').get()).data().salaryPaisa,20000);
});
test('paid withdrawal cannot be refunded a second time',async()=>{
 const requestId=randomUUID();
 await call('bob','withdraw',{requestId,amountPaisa:10000,method:'Nagad',account:'01700000000'});
 await call('admin','reviewWithdrawal',{id:`bob_${requestId}`,status:'paid',reference:'transfer123'},true);
 await assert.rejects(call('admin','reviewWithdrawal',{id:`bob_${requestId}`,status:'rejected',reference:'again'},true));
 assert.equal((await db.doc('wallets/bob').get()).data().salaryPaisa,10000);
});
test('agency application requires approval before membership',async()=>{
 await call('alice','applyAgency',{agencyId:'bd'});
 assert.equal((await db.doc('users/alice').get()).data().agencyId,null);
 await assert.rejects(call('alice','reviewAgency',{uid:'alice',approve:true}));
 await call('admin','reviewAgency',{uid:'alice',approve:true},true);
 assert.equal((await db.doc('users/alice').get()).data().agencyId,'bd');
});
test('suspended users cannot spend coins',async()=>{
 await call('admin','banUser',{uid:'alice',banned:true},true);
 await assert.rejects(call('alice','gift',{roomId:'alice',giftId:'rose',toUid:'bob',quantity:1,requestId:randomUUID()}),e=>e.code==='permission-denied');
});
