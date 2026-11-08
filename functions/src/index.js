import {initializeApp} from 'firebase-admin/app';
import {getFirestore, FieldValue} from 'firebase-admin/firestore';
import {onCall, HttpsError} from 'firebase-functions/v2/https';
import {defineSecret, defineString} from 'firebase-functions/params';
import {AccessToken, RoomServiceClient, TrackSource} from 'livekit-server-sdk';
import {z} from 'zod';
import {transfer, salaryAmount, dhakaDay} from './domain.js';
initializeApp();
const db=getFirestore();
const lkKey=defineSecret('LIVEKIT_API_KEY'), lkSecret=defineSecret('LIVEKIT_API_SECRET');
const lkURL=defineString('LIVEKIT_URL');
const stamp=()=>FieldValue.serverTimestamp();
const id=z.string().regex(/^[A-Za-z0-9_-]{1,128}$/);
const text=z.string().trim().min(1).max(120);
const money=z.number().int().positive().max(10000000);
const reqid=z.string().uuid();
function fail(message,code='failed-precondition'){throw new HttpsError(code,message);}
function parse(schema,data){const r=schema.safeParse(data);if(!r.success)fail('Invalid input','invalid-argument');return r.data;}
const roomRef=(room)=>db.doc(`rooms/${room}`);
const memberRef=(room,uid)=>db.doc(`rooms/${room}/members/${uid}`);
const walletRef=(uid)=>db.doc(`wallets/${uid}`);
function livekit(){return new RoomServiceClient(lkURL.value().replace(/^wss:/,'https:').replace(/^ws:/,'http:'),lkKey.value(),lkSecret.value());}
async function requireHost(room,uid,admin){const r=await roomRef(room).get();if(!r.exists)fail('Room not found','not-found');if(r.data().hostId!==uid&&!admin)fail('Host access required','permission-denied');return r.data();}
const emptyWallet={coins:0,diamonds:0,salaryPaisa:0};
export const api=onCall({region:'asia-south1',secrets:[lkKey,lkSecret],maxInstances:10},async request=>{
 if(!request.auth)fail('Please sign in','unauthenticated');
 const uid=request.auth.uid, admin=request.auth.token.admin===true;
 const {action,...data}=request.data??{};
 if(typeof action!=='string')fail('Missing action','invalid-argument');
 const user=await db.doc(`users/${uid}`).get();
 if(user.data()?.banned)fail('Account suspended','permission-denied');
 const adminOnly=()=>{if(!admin)fail('Admin access required','permission-denied');};
 if(action==='bootstrap'){
  const d=parse(z.object({name:text}),data);
  await db.runTransaction(async t=>{const u=db.doc(`users/${uid}`),w=walletRef(uid);const [a,b]=await Promise.all([t.get(u),t.get(w)]);if(!a.exists)t.set(u,{name:d.name,uid,createdAt:stamp(),banned:false,agencyId:null});if(!b.exists)t.set(w,emptyWallet);});return {ok:true};
 }
 if(!user.exists)fail('Complete your profile first');
 if(action==='createRoom'){
  const d=parse(z.object({title:text}),data);const room=uid;
  await db.runTransaction(async t=>{const r=roomRef(room);const old=await t.get(r);if(old.exists&&old.data().active)fail('You already have an active room');t.set(r,{title:d.title,hostId:uid,hostName:user.data().name,active:true,speakers:[uid],createdAt:stamp()});});return {roomId:room};
 }
 if(action==='joinRoom'){
  const d=parse(z.object({roomId:id}),data);let speaker=false;
  await db.runTransaction(async t=>{const r=await t.get(roomRef(d.roomId)),m=await t.get(memberRef(d.roomId,uid));if(!r.exists||!r.data().active)fail('Room is closed');if(m.data()?.blocked)fail('You were removed from this room','permission-denied');speaker=r.data().speakers.includes(uid);t.set(memberRef(d.roomId,uid),{uid,name:user.data().name,joinedAt:stamp(),lastSeen:stamp(),active:true,blocked:false},{merge:true});});
  const token=new AccessToken(lkKey.value(),lkSecret.value(),{identity:uid,name:user.data().name,ttl:'5m'});
  token.addGrant({roomJoin:true,room:d.roomId,canSubscribe:true,canPublish:speaker,canPublishData:false,canPublishSources:[TrackSource.MICROPHONE]});
  return {token:await token.toJwt(),url:lkURL.value(),speaker};
 }
 if(action==='heartbeat'||action==='leaveRoom'){
  const d=parse(z.object({roomId:id}),data),m=memberRef(d.roomId,uid);
  if((await m.get()).exists)await m.update({active:action==='heartbeat',lastSeen:stamp()});return {ok:true};
 }
 if(action==='requestMic'){
  const d=parse(z.object({roomId:id}),data);const m=await memberRef(d.roomId,uid).get();if(!m.exists||!m.data().active||m.data().blocked)fail('Join this room first');await m.ref.update({requestedMic:true});return {ok:true};
 }
 if(action==='moderate'){
  const d=parse(z.object({roomId:id,targetUid:id,mode:z.enum(['speaker','listener','kick'])}),data);
  await requireHost(d.roomId,uid,admin);
  if(d.roomId===d.targetUid)fail('The host cannot be removed');
  const target=memberRef(d.roomId,d.targetUid);
  await db.runTransaction(async t=>{const r=await t.get(roomRef(d.roomId)),m=await t.get(target);if(!m.exists)fail('Member not found');let speakers=r.data().speakers.filter(x=>x!==d.targetUid);if(d.mode==='speaker'){if(speakers.length>=8)fail('All 8 seats are occupied');speakers.push(d.targetUid);}t.update(roomRef(d.roomId),{speakers});t.update(target,{requestedMic:false,blocked:d.mode==='kick',active:d.mode!=='kick'});});
  // The DB authorization changes first; live-room enforcement must also succeed.
  try{if(d.mode==='kick')await livekit().removeParticipant(d.roomId,d.targetUid);else await livekit().updateParticipant(d.roomId,d.targetUid,undefined,{canSubscribe:true,canPublish:d.mode==='speaker',canPublishData:false,canPublishSources:[TrackSource.MICROPHONE]});}
  catch(e){if(e?.status!==404)fail('Permissions saved, but live moderation failed. Retry the action.');}
  return {ok:true};
 }
 if(action==='closeRoom'){
  const d=parse(z.object({roomId:id}),data);await requireHost(d.roomId,uid,admin);
  await roomRef(d.roomId).update({active:false,closedAt:stamp()});
  try{await livekit().deleteRoom(d.roomId);}catch(e){if(e?.status!==404)fail('Room closed for new joins; live disconnect failed. Retry.');}return {ok:true};
 }
 if(action==='message'){
  const d=parse(z.object({roomId:id,body:z.string().trim().min(1).max(300)}),data);
  const m=await memberRef(d.roomId,uid).get(),r=await roomRef(d.roomId).get();if(!m.data()?.active||m.data()?.blocked||!r.data()?.active)fail('Join an active room first');
  await db.runTransaction(async t=>{const rate=db.doc(`limits/chat_${uid}`),old=await t.get(rate);if(Date.now()-(old.data()?.at??0)<1500)fail('Please wait before sending another message','resource-exhausted');t.set(rate,{at:Date.now()});t.create(roomRef(d.roomId).collection('messages').doc(),{uid,name:user.data().name,body:d.body,createdAt:stamp()});});return {ok:true};
 }
 if(action==='gift'){
  const d=parse(z.object({roomId:id,giftId:id,toUid:id,quantity:z.number().int().min(1).max(99),requestId:reqid}),data);if(uid===d.toUid)fail('You cannot gift yourself');const giftDay=dhakaDay();
  await db.runTransaction(async t=>{
   const event=db.doc(`ledger/gift_${uid}_${d.requestId}`),day=db.doc(`daily/${giftDay}_${d.toUid}`);
   const [prev,g,s,r,room,sm,rm,stats]=await Promise.all([t.get(event),t.get(db.doc(`gifts/${d.giftId}`)),t.get(walletRef(uid)),t.get(walletRef(d.toUid)),t.get(roomRef(d.roomId)),t.get(memberRef(d.roomId,uid)),t.get(memberRef(d.roomId,d.toUid)),t.get(day)]);
   if(prev.exists)return;
   if(!g.data()?.active||!s.exists||!r.exists||!room.data()?.active||!sm.data()?.active||sm.data()?.blocked||!rm.data()?.active||rm.data()?.blocked)fail('Gift or room member unavailable');
   let result;try{result=transfer(s.data().coins,r.data().diamonds,g.data().price,d.quantity);}catch{fail('Insufficient coins or invalid gift');}
   t.update(walletRef(uid),{coins:result.sender});t.update(walletRef(d.toUid),{diamonds:result.receiver});
   t.set(day,{uid:d.toUid,day:giftDay,diamonds:(stats.data()?.diamonds??0)+result.cost});
   t.create(event,{kind:'gift',fromUid:uid,toUid:d.toUid,participants:[uid,d.toUid],roomId:d.roomId,giftId:d.giftId,quantity:d.quantity,coins:result.cost,createdAt:stamp()});
  });return {ok:true};
 }
 if(action==='applyAgency'){
  const d=parse(z.object({agencyId:id}),data);if(user.data().agencyId)fail('You already belong to an agency');
  if(!(await db.doc(`agencies/${d.agencyId}`).get()).data()?.active)fail('Agency unavailable');
  await db.doc(`agencyApplications/${uid}`).set({uid,name:user.data().name,agencyId:d.agencyId,status:'pending',createdAt:stamp()});return {ok:true};
 }
 if(action==='withdraw'){
  const d=parse(z.object({amountPaisa:money,method:z.enum(['bKash','Nagad','Bank']),account:z.string().trim().min(6).max(80),requestId:reqid}),data);
  await db.runTransaction(async t=>{const r=db.doc(`withdrawals/${uid}_${d.requestId}`);const [prev,w,settings]=await Promise.all([t.get(r),t.get(walletRef(uid)),t.get(db.doc('settings/economy'))]);if(prev.exists)return;
   if(!settings.data()?.withdrawalsEnabled)fail('Withdrawals are not enabled');if(d.amountPaisa<(settings.data()?.minimumWithdrawalPaisa??10000))fail('Below minimum withdrawal');
   if((w.data()?.salaryPaisa??0)<d.amountPaisa)fail('Insufficient salary balance');t.update(walletRef(uid),{salaryPaisa:w.data().salaryPaisa-d.amountPaisa});t.create(r,{uid,amountPaisa:d.amountPaisa,method:d.method,account:d.account,status:'pending',createdAt:stamp()});});return {ok:true};
 }
 if(action==='report'){
  const d=parse(z.object({targetUid:id,reason:z.string().trim().min(5).max(500),roomId:id.optional()}),data);await db.collection('reports').add({...d,reporter:uid,status:'open',createdAt:stamp()});return {ok:true};
 }
 adminOnly();
 if(action==='seed'){
  const defaults=[['rose',{name:'Rose',emoji:'🌹',price:10,active:true}],['heart',{name:'Heart',emoji:'💖',price:100,active:true}],['crown',{name:'Crown',emoji:'👑',price:1000,active:true}]];
  await db.runTransaction(async t=>{const settings=db.doc('settings/economy');const snaps=await Promise.all([t.get(settings),...defaults.map(([key])=>t.get(db.doc(`gifts/${key}`)))]);if(!snaps[0].exists)t.create(settings,{minimumDiamonds:1000,dailySalaryPaisa:0,minimumWithdrawalPaisa:10000,withdrawalsEnabled:false});defaults.forEach(([key,val],i)=>{if(!snaps[i+1].exists)t.create(db.doc(`gifts/${key}`),val);});});return {ok:true};
 }
 if(action==='saveGift'){
  const d=parse(z.object({id, name:text,emoji:z.string().min(1).max(12),price:money,active:z.boolean()}),data);await db.doc(`gifts/${d.id}`).set(d);return {ok:true};
 }
 if(action==='saveAgency'){
  const d=parse(z.object({id,name:text,ownerUid:id,active:z.boolean()}),data);if(!(await db.doc(`users/${d.ownerUid}`).get()).exists)fail('Owner must register first');await db.doc(`agencies/${d.id}`).set({...d,country:'BD'});return {ok:true};
 }
 if(action==='reviewAgency'){
  const d=parse(z.object({uid:id,approve:z.boolean()}),data);
  await db.runTransaction(async t=>{const a=db.doc(`agencyApplications/${d.uid}`),u=db.doc(`users/${d.uid}`);const [app,member]=await Promise.all([t.get(a),t.get(u)]);if(!app.exists||app.data().status!=='pending')fail('No pending application');const agency=await t.get(db.doc(`agencies/${app.data().agencyId}`));if(d.approve&&(!agency.data()?.active||member.data()?.agencyId))fail('Agency inactive or user already assigned');t.update(a,{status:d.approve?'approved':'rejected',reviewedBy:uid});if(d.approve)t.update(u,{agencyId:app.data().agencyId});});return {ok:true};
 }
 if(action==='saveEconomy'){
  const d=parse(z.object({minimumDiamonds:money,dailySalaryPaisa:z.number().int().min(0).max(10000000),minimumWithdrawalPaisa:money,withdrawalsEnabled:z.boolean()}),data);await db.doc('settings/economy').set(d);return {ok:true};
 }
 if(action==='creditCoins'){
  const d=parse(z.object({uid:id,coins:money,paymentReference:z.string().regex(/^[A-Za-z0-9_-]{6,100}$/)}),data);
  await db.runTransaction(async t=>{const event=db.doc(`ledger/recharge_${d.paymentReference}`),w=walletRef(d.uid);const [prev,b]=await Promise.all([t.get(event),t.get(w)]);if(prev.exists)fail('Payment reference already credited');if(!b.exists)fail('User not found');t.update(w,{coins:b.data().coins+d.coins});t.create(event,{kind:'recharge',coins:d.coins,participants:[d.uid],paymentReference:d.paymentReference,adminUid:uid,createdAt:stamp()});});return {ok:true};
 }
 if(action==='approveSalary'){
  const d=parse(z.object({uid:id,day:z.string().regex(/^\d{4}-\d{2}-\d{2}$/)}),data);if(d.day>=dhakaDay())fail('Approve only completed Dhaka calendar days');
  await db.runTransaction(async t=>{const sr=db.doc(`salaries/${d.day}_${d.uid}`),wr=walletRef(d.uid);const [prev,stats,settings,u,w]=await Promise.all([t.get(sr),t.get(db.doc(`daily/${d.day}_${d.uid}`)),t.get(db.doc('settings/economy')),t.get(db.doc(`users/${d.uid}`)),t.get(wr)]);if(prev.exists)fail('Salary already approved');if(!u.data()?.agencyId||u.data()?.banned)fail('Active agency membership required');const agency=await t.get(db.doc(`agencies/${u.data().agencyId}`));if(!agency.data()?.active)fail('Agency is inactive');let amount;try{amount=salaryAmount(stats.data()?.diamonds??0,settings.data()?.minimumDiamonds,settings.data()?.dailySalaryPaisa);}catch{fail('Salary disabled or target not reached');}t.update(wr,{salaryPaisa:w.data().salaryPaisa+amount});t.create(sr,{uid:d.uid,day:d.day,amountPaisa:amount,diamonds:stats.data().diamonds,approvedBy:uid,createdAt:stamp()});});return {ok:true};
 }
 if(action==='reviewWithdrawal'){
  const d=parse(z.object({id,status:z.enum(['paid','rejected']),reference:z.string().trim().min(3).max(100)}),data);
  await db.runTransaction(async t=>{const r=db.doc(`withdrawals/${d.id}`),v=await t.get(r);if(!v.exists||v.data().status!=='pending')fail('Already reviewed or not found');const w=walletRef(v.data().uid),b=await t.get(w);if(d.status==='rejected')t.update(w,{salaryPaisa:b.data().salaryPaisa+v.data().amountPaisa});t.update(r,{status:d.status,reference:d.reference,reviewedBy:uid,reviewedAt:stamp()});});return {ok:true};
 }
 if(action==='banUser'){
  const d=parse(z.object({uid:id,banned:z.boolean()}),data);if(uid===d.uid)fail('Cannot suspend yourself');await db.doc(`users/${d.uid}`).update({banned:d.banned});return {ok:true};
 }
 if(action==='resolveReport'){const d=parse(z.object({id}),data);await db.doc(`reports/${d.id}`).update({status:'resolved',reviewedBy:uid});return {ok:true};}
 fail('Unknown action','invalid-argument');
});
