export type VoiceMember={instance:string;muted:boolean;seen:number};
export type VoiceSignal={id:number;from:string;to:string;fromInstance:string;toInstance:string;call:string;type:'offer'|'answer';sdp:string;created:number};
export type VoiceState={members:Record<string,VoiceMember>;signals:VoiceSignal[];seq:number};
export type VoiceView={members:Record<string,VoiceMember>;signals:VoiceSignal[];cursor:number;iceServers?:RTCIceServer[];relayConfigured?:boolean};
