import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { money } from './format';

type Month={month:string;currency:string;total_minor:number;count:number};
export default function MonthlyChart({data}:{data:Month[]}){
  return <div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><AreaChart data={data} margin={{top:12,right:6,left:-18,bottom:0}}><defs><linearGradient id="fillTeal" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#48a99d" stopOpacity={0.2}/><stop offset="95%" stopColor="#48a99d" stopOpacity={0}/></linearGradient></defs><CartesianGrid vertical={false} stroke="#edf0f2"/><XAxis dataKey="month" tickFormatter={v=>new Date(`${v}-02`).toLocaleDateString(undefined,{month:'short'})} axisLine={false} tickLine={false} tick={{fontSize:11,fill:'#8b949e'}}/><YAxis axisLine={false} tickLine={false} tick={{fontSize:11,fill:'#8b949e'}} tickFormatter={v=>`${Math.round(v/100/1000)}k`}/><Tooltip formatter={(v:number)=>money(v)} labelFormatter={v=>new Date(`${v}-02`).toLocaleDateString(undefined,{month:'long',year:'numeric'})}/><Area type="monotone" dataKey="total_minor" stroke="#328d83" strokeWidth={2.5} fill="url(#fillTeal)"/></AreaChart></ResponsiveContainer></div>;
}
