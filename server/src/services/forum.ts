import type { PrismaClient } from "@prisma/client";
export const FORUM_CATEGORIES=[{code:"GENERAL",name:"Общение",description:"Общие темы и разговоры"},{code:"HELP",name:"Помощь",description:"Вопросы и помощь игроков"},{code:"SUGGESTIONS",name:"Предложения",description:"Идеи по развитию сервера"},{code:"BUGS",name:"Ошибки",description:"Сообщения об игровых ошибках"},{code:"ROLEPLAY",name:"Ролевые ситуации",description:"Истории и игровые ситуации"}] as const;
export function isForumCategory(code:string){return FORUM_CATEGORIES.some(c=>c.code===code);}
export async function listForumThreads(prisma:PrismaClient,categoryCode:string,page=1){
 if(!isForumCategory(categoryCode))throw new Error("FORUM_CATEGORY_NOT_FOUND");
 const rows=await prisma.forumThread.findMany({where:{categoryCode,status:{not:"HIDDEN"}},orderBy:[{pinned:"desc"},{updatedAt:"desc"}],skip:(page-1)*20,take:20,select:{id:true,title:true,content:true,pinned:true,views:true,createdAt:true,updatedAt:true,author:{select:{nickname:true}},_count:{select:{posts:true}}}});
 return rows.map(x=>({...x,replyCount:x._count.posts,_count:undefined}));
}
export async function getForumThread(prisma:PrismaClient,id:string){
 const row=await prisma.forumThread.findFirst({where:{id,status:{not:"HIDDEN"}},include:{author:{select:{nickname:true}},posts:{where:{status:"VISIBLE"},orderBy:{createdAt:"asc"},take:100,include:{author:{select:{nickname:true}}}}}});
 if(!row)throw new Error("FORUM_THREAD_NOT_FOUND");
 await prisma.forumThread.update({where:{id},data:{views:{increment:1}}});return row;
}
export async function createForumThread(prisma:PrismaClient,input:{profileId:string;categoryCode:string;title:string;content:string}){
 if(!isForumCategory(input.categoryCode))throw new Error("FORUM_CATEGORY_NOT_FOUND");
 const title=input.title.trim(),content=input.content.trim();if(title.length<5||title.length>80||content.length<20||content.length>5000)throw new Error("INVALID_FORUM_CONTENT");
 return prisma.forumThread.create({data:{categoryCode:input.categoryCode,title,content,authorProfileId:input.profileId},select:{id:true,categoryCode:true,title:true,status:true,createdAt:true}});
}
export async function createForumReply(prisma:PrismaClient,input:{profileId:string;threadId:string;content:string}){
 const content=input.content.trim();if(content.length<2||content.length>3000)throw new Error("INVALID_FORUM_CONTENT");
 return prisma.$transaction(async tx=>{const thread=await tx.forumThread.findFirst({where:{id:input.threadId,status:"OPEN"},select:{id:true}});if(!thread)throw new Error("FORUM_THREAD_NOT_OPEN");const post=await tx.forumPost.create({data:{threadId:thread.id,authorProfileId:input.profileId,content},select:{id:true,threadId:true,content:true,createdAt:true}});await tx.forumThread.update({where:{id:thread.id},data:{updatedAt:new Date()}});return post;});
}
