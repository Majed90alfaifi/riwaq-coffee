import {env} from 'cloudflare:workers';
import {handle} from '../../../server/api.mjs';
export const dynamic='force-dynamic';
export const GET=(req:Request)=>handle(req,env);
export const POST=(req:Request)=>handle(req,env);
export const PATCH=(req:Request)=>handle(req,env);
