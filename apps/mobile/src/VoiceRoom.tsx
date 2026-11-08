import React,{useEffect,useState} from 'react';
import {View,Text,Pressable,StyleSheet} from 'react-native';
import {AudioSession,LiveKitRoom,useLocalParticipant,useParticipants} from '@livekit/react-native';
export default function VoiceRoom({session,onLeave,onError}:{session:{token:string,url:string},onLeave:()=>void,onError:(message:string)=>void}){
 const [ready,setReady]=useState(false);
 useEffect(()=>{let live=true;AudioSession.startAudioSession().then(()=>{if(live)setReady(true);else void AudioSession.stopAudioSession();}).catch(e=>onError(String(e)));return()=>{live=false;void AudioSession.stopAudioSession();};},[]);
 if(!ready)return <Text style={{color:'white'}}>Starting audio…</Text>;
 return <LiveKitRoom serverUrl={session.url} token={session.token} connect audio={false} video={false} onDisconnected={onLeave} onError={e=>onError(e.message)}><Controls onError={onError}/></LiveKitRoom>;
}
function Controls({onError}:{onError:(message:string)=>void}){
 const {localParticipant,isMicrophoneEnabled}=useLocalParticipant();const participants=useParticipants();
 return <View><View style={s.grid}>{participants.map(p=><View key={p.identity} style={[s.person,p.isSpeaking&&s.speaking]}><Text style={s.avatar}>{(p.name||'M').slice(0,1).toUpperCase()}</Text><Text style={s.text}>{p.name||p.identity.slice(0,8)}</Text><Text style={s.caption}>{p.permissions?.canPublish?'🎙 Speaker':'🎧 Listener'}</Text></View>)}</View><Pressable style={s.button} disabled={!localParticipant.permissions?.canPublish} onPress={()=>localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled).catch(e=>onError(String(e)))}><Text style={s.text}>{localParticipant.permissions?.canPublish?(isMicrophoneEnabled?'Mute microphone':'Turn on microphone'):'Ask the host for a mic seat below'}</Text></Pressable></View>;
}
const s=StyleSheet.create({grid:{flexDirection:'row',flexWrap:'wrap',gap:12,marginVertical:18},person:{width:'29%',padding:10,alignItems:'center',borderRadius:18,backgroundColor:'#20243d',borderWidth:2,borderColor:'#20243d'},speaking:{borderColor:'#74e7bd'},avatar:{fontSize:26,color:'#a99bff',fontWeight:'800'},text:{color:'white',textAlign:'center'},caption:{fontSize:11,color:'#b3b6cd',marginTop:6},button:{padding:14,backgroundColor:'#6556d9',borderRadius:14}});
