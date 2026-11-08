import {createRequire} from 'node:module';
const require=createRequire(new URL('../functions/package.json',import.meta.url));
const {initializeApp,applicationDefault}=require('firebase-admin/app');
const {getAuth}=require('firebase-admin/auth');
const uid=process.argv[2];
if(!uid||!process.env.GOOGLE_CLOUD_PROJECT){console.error('Set GOOGLE_CLOUD_PROJECT and pass the registered user UID.');process.exit(1);}
initializeApp({credential:applicationDefault(),projectId:process.env.GOOGLE_CLOUD_PROJECT});
const auth=getAuth(),user=await auth.getUser(uid);
await auth.setCustomUserClaims(uid,{...user.customClaims,admin:true});
console.log('Administrator claim set. Sign out and sign back in.');
