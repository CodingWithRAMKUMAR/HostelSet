const DAY_MS = 86400000
function parseDateOnly(value) { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || '')); if (!m) return null; const year=+m[1], month=+m[2], day=+m[3]; const d=new Date(year,month-1,day); return d.getFullYear()===year&&d.getMonth()===month-1&&d.getDate()===day?{year,month,day}:null }
function anchoredDate(start, offset) { const index=start.year*12+start.month-1+offset; const year=Math.floor(index/12), monthIndex=index%12; return new Date(year,monthIndex,Math.min(start.day,new Date(year,monthIndex+1,0).getDate())) }
function isConfirmedRent(payment) { return payment?.status === 'success' && payment?.payment_method !== 'security_deposit' }
function calculateCanonicalRentDue(tenant, payments = [], now = new Date()) {
  const start=parseDateOnly(tenant?.rent_start_date||tenant?.move_in_date||tenant?.join_date), rent=Number(tenant?.rent_amount||tenant?.monthly_rent)
  if (!start || !(rent>0)) return {status:'unknown',dueDate:null,daysUntilDue:null,dueAmount:Number(tenant?.pending_amount||0),message:'Due date unavailable'}
  if (['inactive','archived'].includes(tenant?.status)) return {status:'inactive',dueDate:null,daysUntilDue:null,dueAmount:0,message:'Tenancy inactive'}
  const seen=new Set(), confirmed=payments.filter(isConfirmedRent).reduce((sum,p)=>{const key=p.id||`${p.payment_date||''}:${p.payment_method||''}:${p.amount||0}`;if(seen.has(key))return sum;seen.add(key);return sum+Number(p.amount||0)},0)
  const paidPeriods=Math.max(0,Math.floor((confirmed+0.0001)/rent)), dueDate=anchoredDate(start,paidPeriods+1), today=new Date(now.getFullYear(),now.getMonth(),now.getDate()), daysUntilDue=Math.round((dueDate-today)/DAY_MS), dueAmount=rent
  if(daysUntilDue<0)return{status:'overdue',dueDate,daysUntilDue,dueAmount,message:`Overdue by ${Math.abs(daysUntilDue)} days`,urgent:true}
  if(daysUntilDue===0)return{status:'due_today',dueDate,daysUntilDue,dueAmount,message:'Due today',urgent:true}
  return{status:daysUntilDue<=5?'due_soon':'pending',dueDate,daysUntilDue,dueAmount,message:daysUntilDue<=5?`Due in ${daysUntilDue} day${daysUntilDue===1?'':'s'}`:'Rent pending',urgent:daysUntilDue<=5}
}
module.exports={parseDateOnly,anchoredDate,isConfirmedRent,calculateCanonicalRentDue}
