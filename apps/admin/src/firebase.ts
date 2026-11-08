import {initializeApp} from 'firebase/app';
import {getAuth} from 'firebase/auth';
import {getFirestore} from 'firebase/firestore';
import {getFunctions,httpsCallable} from 'firebase/functions';
const e=import.meta.env;
export const configured=Boolean(e.VITE_FIREBASE_API_KEY&&e.VITE_FIREBASE_PROJECT_ID&&e.VITE_FIREBASE_APP_ID);
const app=initializeApp(configured?{apiKey:e.VITE_FIREBASE_API_KEY,authDomain:e.VITE_FIREBASE_AUTH_DOMAIN,projectId:e.VITE_FIREBASE_PROJECT_ID,appId:e.VITE_FIREBASE_APP_ID}:{apiKey:'not-configured',projectId:'maira-setup',appId:'not-configured'});
export const auth=getAuth(app),db=getFirestore(app);
const call=httpsCallable(getFunctions(app,'asia-south1'),'api');
export async function api(action:string,data:Record<string,unknown>={}){return (await call({action,...data})).data;}
