const DAY_MS = 86400000
const NON_MONTHLY_RENT_METHODS = new Set(['security_deposit', 'deposit', 'pre_booking', 'joining_fee', 'application_fee'])
function parseDateOnly(value) { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || '')); if (!m) return null; const year=+m[1], month=+m[2], day=+m[3]; const d=new Date(year,month-1,day); return d.getFullYear()===year&&d.getMonth()===month-1&&d.getDate()===day?{year,month,day}:null }
function anchoredDate(start, offset) { const index=start.year*12+start.month-1+offset; const year=Math.floor(index/12), monthIndex=index%12; return new Date(year,monthIndex,Math.min(start.day,new Date(year,monthIndex+1,0).getDate())) }
function isConfirmedRent(payment) { return payment?.status === 'success' && !NON_MONTHLY_RENT_METHODS.has(String(payment?.payment_method || '').toLowerCase()) }
function uniqueConfirmedRentPayments(payments = []) {
  const seen = new Set()
  return (payments || [])
    .filter(isConfirmedRent)
    .filter(payment => {
      const key = payment?.id || `${payment?.payment_date || ''}:${payment?.payment_method || ''}:${payment?.amount || 0}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .sort((a, b) => new Date(a.payment_date || a.created_at || 0) - new Date(b.payment_date || b.created_at || 0))
}

function baselinePaidPeriodsFromTenant(tenant, start, rent, confirmedPayments) {
  if (confirmedPayments.length > 0) return 0
  if (String(tenant?.rent_status || '').toLowerCase() !== 'paid') return 0
  if (Number(tenant?.pending_amount || 0) > 0) return 0
  if (Number(tenant?.total_paid || 0) > 0) return 0
  const recognizedAt = parseDateOnly(tenant?.rent_recognized_at || tenant?.processed_at || tenant?.created_at)
  if (!recognizedAt) return 0
  const recognizedDate = new Date(recognizedAt.year, recognizedAt.month - 1, recognizedAt.day)
  let periods = 0
  while (periods < 600 && anchoredDate(start, periods) < recognizedDate) periods += 1
  return periods
}

function calculateCanonicalRentDue(tenant, payments = [], now = new Date()) {
  const start=parseDateOnly(tenant?.rent_start_date||tenant?.move_in_date||tenant?.join_date), rent=Number(tenant?.rent_amount||tenant?.monthly_rent)
  if (!start || !(rent>0)) return {status:'unknown',dueDate:null,daysUntilDue:null,dueAmount:Number(tenant?.pending_amount||0),message:'Due date unavailable',oldestUnpaidCycle:null,isFullyUpToDate:false}
  if (['inactive','archived'].includes(tenant?.status)) return {status:'inactive',dueDate:null,daysUntilDue:null,dueAmount:0,message:'Tenancy inactive',oldestUnpaidCycle:null,isFullyUpToDate:false}
  const confirmedPayments=uniqueConfirmedRentPayments(payments), confirmed=confirmedPayments.reduce((sum,p)=>sum+Number(p.amount||0),0)
  let remaining=confirmed, paidPeriods=baselinePaidPeriodsFromTenant(tenant, start, rent, confirmedPayments)
  while (remaining + 0.0001 >= rent) { remaining -= rent; paidPeriods += 1 }
  const dueDate=anchoredDate(start,paidPeriods), today=new Date(now.getFullYear(),now.getMonth(),now.getDate()), daysUntilDue=Math.round((dueDate-today)/DAY_MS), paidAmountForOpenCycle=Math.max(0,remaining), dueAmount=Math.max(0,rent-paidAmountForOpenCycle)
  const oldestUnpaidCycle={index:paidPeriods,dueDate,dueAmount,paidAmount:paidAmountForOpenCycle,requiredAmount:rent}
  const base={dueDate,daysUntilDue,dueAmount,paidPeriods,confirmedAmount:confirmed,paidAmountForOpenCycle,cycleIndex:paidPeriods,paidForCurrentCycle:false,oldestUnpaidCycle,isFullyUpToDate:false}
  if(daysUntilDue<0)return{...base,status:'overdue',message:`Overdue by ${Math.abs(daysUntilDue)} days`,urgent:true}
  if(daysUntilDue===0)return{...base,status:'due_today',message:'Due today',urgent:true}
  if(daysUntilDue>3)return{...base,status:'paid',message:'Paid',urgent:false,paidForCurrentCycle:true,isFullyUpToDate:true}
  return{...base,status:'due_soon',message:`Due in ${daysUntilDue} day${daysUntilDue===1?'':'s'}`,urgent:true}
}
function formatRentDueLabel(result = {}) {
  if (result.status === 'paid') return 'Paid'
  if (result.status === 'inactive') return result.message || 'Tenancy inactive'
  if (result.status === 'unknown') return result.message || 'Due date unavailable'
  const days = Number(result.daysUntilDue)
  if (!Number.isFinite(days)) return result.message || 'Due date unavailable'
  if (days < 0) { const overdue = Math.abs(days); return `Overdue by ${overdue} day${overdue === 1 ? '' : 's'}` }
  if (days === 0) return 'Due today'
  if (days === 1) return 'Due tomorrow'
  return `Due in ${days} days`
}
module.exports={parseDateOnly,anchoredDate,isConfirmedRent,uniqueConfirmedRentPayments,calculateCanonicalRentDue,formatRentDueLabel}
