import type { FastifyInstance } from "fastify";
import { z } from "zod";
import argon2 from "argon2";
const registerSchema=z.object({email:z.string().email().max(254).transform(v=>v.toLowerCase().trim()),password:z.string().min(10).max(128),nickname:z.string().trim().min(3).max(20).regex(/^[a-zA-Zа-яА-ЯёЁ0-9_]+$/)});
const loginSchema=z.object({email:z.string().email().max(254).transform(v=>v.toLowerCase().trim()),password:z.string().min(1).max(128)});
export async function authRoutes(app:FastifyInstance){
 app.post("/register",async(request,reply)=>{
  const parsed=registerSchema.safeParse(request.body);
  if(!parsed.success)return reply.code(400).send({error:"INVALID_INPUT"});
  const {email,password,nickname}=parsed.data;
  const passwordHash=await argon2.hash(password,{type:argon2.argon2id});
  try{
   const user=await app.prisma.user.create({data:{email,passwordHash,profile:{create:{nickname}},wallet:{create:{balance:0n}}},select:{id:true,email:true,createdAt:true}});
   const token=app.jwt.sign({sub:user.id,role:"PLAYER"},{expiresIn:"2h"});
   return reply.code(201).send({user,token});
  }catch{return reply.code(409).send({error:"EMAIL_OR_NICKNAME_TAKEN"});}
 });
 app.post("/login",async(request,reply)=>{
  const parsed=loginSchema.safeParse(request.body);
  if(!parsed.success)return reply.code(400).send({error:"INVALID_INPUT"});
  const user=await app.prisma.user.findUnique({where:{email:parsed.data.email}});
  if(!user||!(await argon2.verify(user.passwordHash,parsed.data.password)))return reply.code(401).send({error:"INVALID_CREDENTIALS"});
  const ban=await app.prisma.accountBan.findFirst({where:{userId:user.id,status:"ACTIVE"}});
  if(ban){
   const appealToken=app.jwt.sign({sub:user.id,role:"BANNED_APPEAL",scope:"ban:appeal"},{expiresIn:"20m"});
   return reply.code(403).send({error:"ACCOUNT_BANNED",reason:ban.reason,appealToken,canAppeal:true});
  }
  const token=app.jwt.sign({sub:user.id,role:"PLAYER"},{expiresIn:"2h"});
  return reply.send({user:{id:user.id,email:user.email},token});
 });
}