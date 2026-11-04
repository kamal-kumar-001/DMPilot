const {test}=require('node:test');const assert=require('node:assert/strict');
const {ReplyDeskService}=require('../../apps/api/dist/instagram/reply-desk.service');
test('general comments: exact keywords only, creator identity by ID/handle, unreplied order before bounded take',async()=>{
 let args;
 const accounts=[{id:'a',username:'Creator',instagramId:'ig-creator',instagramPageId:'page-creator'},{id:'b',username:'second',instagramId:'ig-second'}];
 const comment=(id,text,username='audience',userId='audience',instagramAccountId='a',isReplied=false)=>({id,text,username,userId,instagramAccountId,isReplied,createdAt:new Date(),commentId:id,mediaId:'m'});
 const rows=[comment('keyword',' LINK '),comment('own-id','Thanks','unknown','ig-creator'),comment('own-handle','Thanks','@CREATOR'),comment('question','Can you explain the link?'),comment('single','Amazing'),comment('different-account','link','audience','audience','b'),comment('prefix','Check your DMs for my question'),comment('reply','Replied question','audience','audience','a',true)];
 const service=new ReplyDeskService({instagramAccount:{findMany:async()=>accounts},keyword:{findMany:async()=>[{keyword:'link',campaign:{instagramAccountId:'a'}}]},comment:{findMany:async(a)=>{args=a;return rows}}},{},{},{});
 const result=await service.getBuyerQueries('owner');
 assert.deepEqual(result.map(x=>x.id),['question','single','different-account','prefix','reply']);
 assert(result.every(x=>x.category==='GENERAL' && x.suggestedReply===''));
 assert.deepEqual(args.orderBy,[{isReplied:'asc'},{createdAt:'asc'},{id:'asc'}]);assert.equal(args.take,100);
 assert(args.where.NOT.OR.some(x=>x.text?.equals==='link' && x.instagramAccountId==='a'));
});
