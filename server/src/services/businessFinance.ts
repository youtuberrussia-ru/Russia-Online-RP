import type { PrismaClient } from "@prisma/client";
type Db=PrismaClient;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function parseAmount(value:string){if(!/^(0|[1-9][0-9]{0,11})$/.test(value))throw new Error("INVALID_AMOUNT");return BigInt(value);}
function assertRequestId(value:string){if(!UUID.test(value))throw new Error("INVALID_REQUEST_ID");}
async function authorize(tx:any,profileId:string,businessId:string,ownerOnly=false){
 const b=await tx.business.findUnique({where:{id:businessId},select:{id:true,ownerProfileId:true,status:true,cashBalance:true,monthlyRent:true,taxRateBps:true,lastSettlementAt:true}});
 if(!b||b.status!=="ACTIVE")throw new Error("BUSINESS_NOT_FOUND");
 if(b.ownerProfileId===profileId)return b;
 if(ownerOnly)throw new Error("BUSINESS_OWNER_REQUIRED");
 const e=await tx.businessEmployee.findUnique({where:{businessId_profileId:{businessId,profileId}},select:{canManageCash:true}});
 if(!e?.canManageCash)throw new Error("BUSINESS_PERMISSION_DENIED");
 return b;
}
export async function configureBusinessFinance(prisma:Db,input:{profileId:string;businessId:string;monthlyRent:string;taxRateBps:number}){
 const rent=parseAmount(input.monthlyRent);
 if(!Number.isInteger(input.taxRateBps)||input.taxRateBps<0||input.taxRateBps>3000)throw new Error("INVALID_TAX_RATE");
 return prisma.$transaction(async tx=>{await authorize(tx,input.profileId,input.businessId,true);const b=await tx.business.update({where:{id:input.businessId},data:{monthlyRent:rent,taxRateBps:input.taxRateBps},select:{id:true,monthlyRent:true,taxRateBps:true}});return {businessId:b.id,monthlyRent:b.monthlyRent.toString(),taxRateBps:b.taxRateBps};},{isolationLevel:"Serializable"});
}
export async function setBusinessEmployeeSalary(prisma:Db,input:{profileId:string;businessId:string;employeeId:string;monthlySalary:string}){
 const salary=parseAmount(input.monthlySalary);
 return prisma.$transaction(async tx=>{await authorize(tx,input.profileId,input.businessId,true);const e=await tx.businessEmployee.findFirst({where:{id:input.employeeId,businessId:input.businessId},select:{id:true,profile:{select:{nickname:true}}}});if(!e)throw new Error("EMPLOYEE_NOT_FOUND");const u=await tx.businessEmployee.update({where:{id:e.id},data:{monthlySalary:salary},select:{id:true,monthlySalary:true}});return {employeeId:u.id,nickname:e.profile.nickname,monthlySalary:u.monthlySalary.toString()};},{isolationLevel:"Serializable"});
}
export async function recordBusinessExpense(prisma:Db,input:{profileId:string;businessId:string;category:string;description:string;amount:string;requestId:string}){
 const value=parseAmount(input.amount);if(value<=0n)throw new Error("INVALID_AMOUNT");assertRequestId(input.requestId);const key="business-expense:"+input.businessId+":"+input.requestId;
 return prisma.$transaction(async tx=>{const old=await tx.businessLedger.findUnique({where:{idempotencyKey:key}});if(old)return {alreadyRecorded:true,expenseId:old.id,balance:old.balanceAfter.toString()};const b=await authorize(tx,input.profileId,input.businessId);const debit=await tx.business.updateMany({where:{id:b.id,status:"ACTIVE",cashBalance:{gte:value}},data:{cashBalance:{decrement:value}}});if(debit.count!==1)throw new Error("INSUFFICIENT_BUSINESS_FUNDS");const u=await tx.business.findUniqueOrThrow({where:{id:b.id},select:{cashBalance:true}});const row=await tx.businessLedger.create({data:{businessId:b.id,kind:"EXPENSE",amount:-value,balanceAfter:u.cashBalance,reason:input.category+": "+input.description.trim(),idempotencyKey:key}});return {alreadyRecorded:false,expenseId:row.id,amount:value.toString(),balance:u.cashBalance.toString()};},{isolationLevel:"Serializable"});
}
export async function settleBusinessPeriod(prisma:Db,input:{profileId:string;businessId:string;now?:Date}){
 const now=input.now??new Date();
 return prisma.$transaction(async tx=>{
  const b=await authorize(tx,input.profileId,input.businessId,true);const start=b.lastSettlementAt;
  if(now.getTime()-start.getTime()<30*86400000)throw new Error("BUSINESS_SETTLEMENT_NOT_DUE");
  const key="business-settlement:"+b.id+":"+start.toISOString();const old=await tx.businessSettlement.findUnique({where:{idempotencyKey:key}});if(old)return {alreadySettled:true,settlementId:old.id,totalPaid:old.totalPaid.toString()};
  const sales=await tx.businessLedger.aggregate({where:{businessId:b.id,kind:"SALE",createdAt:{gte:start,lt:now}},_sum:{amount:true}});
  const gross=sales._sum.amount??0n;const staff=await tx.businessEmployee.findMany({where:{businessId:b.id},select:{monthlySalary:true}});const payroll=staff.reduce((n,e)=>n+e.monthlySalary,0n);const rent=b.monthlyRent;const tax=gross*BigInt(b.taxRateBps)/10000n;const total=payroll+rent+tax;
  if(total>0n){const debit=await tx.business.updateMany({where:{id:b.id,status:"ACTIVE",cashBalance:{gte:total}},data:{cashBalance:{decrement:total},lastSettlementAt:now}});if(debit.count!==1)throw new Error("INSUFFICIENT_BUSINESS_FUNDS");}
  else await tx.business.update({where:{id:b.id},data:{lastSettlementAt:now}});
  const u=await tx.business.findUniqueOrThrow({where:{id:b.id},select:{cashBalance:true}});
  const charges:[string,bigint,string][]=[["PAYROLL",payroll,"Выплата зарплат сотрудникам"],["RENT",rent,"Оплата аренды помещения"],["TAX",tax,"Налог с выручки за расчётный период"]];
  for(const [kind,value,reason] of charges)if(value>0n)await tx.businessLedger.create({data:{businessId:b.id,kind,amount:-value,balanceAfter:u.cashBalance,reason,idempotencyKey:key+":"+kind}});
  const row=await tx.businessSettlement.create({data:{businessId:b.id,periodStart:start,periodEnd:now,grossRevenue:gross,payroll,rent,tax,totalPaid:total,idempotencyKey:key}});
  return {alreadySettled:false,settlementId:row.id,periodStart:start,periodEnd:now,grossRevenue:gross.toString(),payroll:payroll.toString(),rent:rent.toString(),tax:tax.toString(),totalPaid:total.toString(),businessCashBalance:u.cashBalance.toString()};
 },{isolationLevel:"Serializable"});
}
export async function getBusinessFinanceReport(prisma:Db,profileId:string,businessId:string,days=30){
 if(!Number.isInteger(days)||days<1||days>90)throw new Error("INVALID_REPORT_RANGE");await authorize(prisma,profileId,businessId);
 const since=new Date(Date.now()-days*86400000);
 const [b,entries,employees,settlements]=await Promise.all([
  prisma.business.findUniqueOrThrow({where:{id:businessId},select:{displayName:true,cashBalance:true,monthlyRent:true,taxRateBps:true,lastSettlementAt:true}}),
  prisma.businessLedger.findMany({where:{businessId,createdAt:{gte:since}},orderBy:{createdAt:"desc"},take:500,select:{kind:true,amount:true,balanceAfter:true,reason:true,createdAt:true}}),
  prisma.businessEmployee.findMany({where:{businessId},select:{id:true,jobTitle:true,monthlySalary:true,profile:{select:{nickname:true}}}}),
  prisma.businessSettlement.findMany({where:{businessId,periodEnd:{gte:since}},orderBy:{periodEnd:"desc"},take:6})
 ]);
 const sum=(kind:string)=>entries.filter(e=>e.kind===kind).reduce((n,e)=>n+e.amount,0n);
 const sales=sum("SALE"),restock=sum("RESTOCK"),payroll=sum("PAYROLL"),rent=sum("RENT"),tax=sum("TAX"),expenses=sum("EXPENSE");
 return {business:b.displayName,periodDays:days,since,cashBalance:b.cashBalance.toString(),totals:{sales:sales.toString(),restock:restock.toString(),payroll:payroll.toString(),rent:rent.toString(),tax:tax.toString(),otherExpenses:expenses.toString(),netCashFlow:(sales+restock+payroll+rent+tax+expenses).toString()},policy:{monthlyRent:b.monthlyRent.toString(),taxRateBps:b.taxRateBps,lastSettlementAt:b.lastSettlementAt},employees:employees.map(e=>({id:e.id,nickname:e.profile.nickname,jobTitle:e.jobTitle,monthlySalary:e.monthlySalary.toString()})),settlements:settlements.map(s=>({id:s.id,periodStart:s.periodStart,periodEnd:s.periodEnd,grossRevenue:s.grossRevenue.toString(),payroll:s.payroll.toString(),rent:s.rent.toString(),tax:s.tax.toString(),totalPaid:s.totalPaid.toString()})),ledger:entries.map(e=>({...e,amount:e.amount.toString(),balanceAfter:e.balanceAfter.toString()}))};
}
