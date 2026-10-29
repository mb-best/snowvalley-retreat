import{clamp}from'./core.js';
export const BASE_SPEED=4/3.6,MAX_ALTITUDE=8000,JUMP_VELOCITY=10.2,GRAVITY=18;
export const DEFAULT_SPEEDS={walkBoost:3,horse:6,horseBoost:12,flight:10,flightBoost:20,vertical:6,uphill:1,downhill:1};
export const SPEED_LABELS={walkBoost:'步行 · 按加速键',horse:'骑马 · 常速',horseBoost:'骑马 · 按加速键',flight:'飞行 · 常速',flightBoost:'飞行 · 按加速键',vertical:'飞行 · 上升／下降',uphill:'上坡速度扣减',downhill:'下坡速度增加'};
export function speedsFrom(value={}){return Object.fromEntries(Object.entries(DEFAULT_SPEEDS).map(([k,v])=>[k,clamp(Number(value[k])||v,1,20)]));}
export function movementSpeed(settings,{flying=false,riding=false,boost=false,grade=0}={}){let n=flying?(boost?settings.flightBoost:settings.flight):riding?(boost?settings.horseBoost:settings.horse):boost?settings.walkBoost:1;if(!flying)n+=grade>0?-settings.uphill*Math.min(1,grade):settings.downhill*Math.min(1,-grade);return BASE_SPEED*clamp(n,.25,20);}
export function clockAdvance(realSeconds,dayMinutes){return realSeconds/(clamp(dayMinutes,10,1440)*60)*24;}
export class WeatherClock{
 constructor(interval=5){this.interval=Math.max(5,Number(interval)||5)*60;this.elapsed=0;}
 update(realSeconds,enabled,season,current,random=Math.random){if(!enabled){this.elapsed=0;return null;}this.elapsed+=Math.max(0,realSeconds);if(this.elapsed<this.interval)return null;this.elapsed%=this.interval;const choices=season===3?['clear','cloudy','fog','snow']:['clear','clear','cloudy','fog','rain'];const list=choices.filter(x=>x!==current);return list[Math.min(list.length-1,Math.floor(random()*list.length))];}
}
