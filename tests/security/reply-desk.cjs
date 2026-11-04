const {test}=require('node:test');const assert=require('node:assert/strict');
const {ReplyDeskService}=require('../../apps/api/dist/instagram/reply-desk.service');
test('general comments: exact keywords only, creator identity by ID/handle, unreplied order before bounded take',async()=>{
 let args;
 const accounts=[{id:'a',username:'Creator',instagramId:'ig-creator',instagramPageId:'page-creator'},{id:'b',username:'second',instagramId:'ig-second'}];
 const comment=(id,text,username='audience',userId='audience',instagramAccountId='a',isReplied=false)=>({id,text,username,userId,instagramAccountId,isReplied,createdAt:new Date(),commentId:id,mediaId:'m'});
 const rows=[comment('keyword',' LINK '),comment('own-id','Thanks','unknown','ig-creator'),comment('own-handle','Thanks','@CREATOR'),comment('question','Can you explain the link?'),comment('single','Amazing'),comment('different-account','link','audience','audience','b'),comment('prefix','Check your DMs for my question'),comment('reply','Replied question','audience','audience','a',true)];
 const service=new ReplyDeskService({instagramAccount:{findMany:async()=>accounts},keyword:{findMany:async()=>[{keyword:'link',campaign:{instagramAccountId:'a'}}]},$queryRaw:async(a)=>{args=a;return rows}},{},{},{});
 const result=await service.getBuyerQueries('owner');
 assert.deepEqual(result.map(x=>x.id),['question','single','different-account','prefix','reply']);
 assert(result.every(x=>x.category==='GENERAL' && x.suggestedReply===''));
 assert.match(args.text,/ORDER BY c."isReplied" ASC, c."createdAt" ASC, c."id" ASC\s+LIMIT 100/);
 assert.match(args.text,/lower\(regexp_replace/);assert(args.values.includes('link'));assert(args.values.includes('@creator'));
 assert(!args.text.includes('link')); // keyword is parameterized,never SQL text

});
