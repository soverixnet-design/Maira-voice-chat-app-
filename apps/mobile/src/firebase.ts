import {initializeApp} from 'firebase/app';
import {initializeAuth, getReactNativePersistence} from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {getFirestore} from 'firebase/firestore';
import {getFunctions, httpsCallable} from 'firebase/functions';
const config={apiKey:process.env.EXPO_PUBLIC_FIREBASE_API_KEY,authDomain:process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,projectId:process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,appId:process.env.EXPO_PUBLIC_FIREBASE_APP_ID};
export const configured=Boolean(config.apiKey&&config.projectId&&config.appId);
const app=initializeApp(configured?config:{apiKey:'not-configured',projectId:'maira-setup',appId:'not-configured'});
export const auth=initializeAuth(app,{persistence:getReactNativePersistence(AsyncStorage)});
export const db=getFirestore(app);
const call=httpsCallable(getFunctions(app,'asia-south1'),'api');
export async function api(action:string,data:Record<string,unknown>={}){
 if(action!=='gift'&&action!=='withdraw') return (await call({action,...data})).data as any;
 const key=`maira.pending.${auth.currentUser?.uid}.${action}`;
 const signature=JSON.stringify(data);
 const saved=await AsyncStorage.getItem(key);
 let requestId:string;
 if(saved){const pending=JSON.parse(saved);if(pending.signature!==signature)throw Error('A previous request is unresolved. Retry its original details before starting a different transaction.');requestId=pending.requestId;}
 else {requestId=crypto.randomUUID();await AsyncStorage.setItem(key,JSON.stringify({signature,requestId}));}
 try {const result=(await call({action,...data,requestId})).data;await AsyncStorage.removeItem(key);return result as any;}
 catch(e:any){if(['functions/invalid-argument','functions/permission-denied','functions/unauthenticated','functions/failed-precondition'].includes(e?.code))await AsyncStorage.removeItem(key);throw e;}
}
