// Firebase's runtime exposes this in its react-native export condition, but the
// package's top-level browser declaration omits it. Keep the native signature.
import 'firebase/auth';
import type {Persistence} from 'firebase/auth';
import type AsyncStorage from '@react-native-async-storage/async-storage';
declare module 'firebase/auth' {
 export function getReactNativePersistence(storage:typeof AsyncStorage):Persistence;
}
