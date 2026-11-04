import subprocess,time,requests,websocket,json,base64,os,tempfile,collections
root=os.path.abspath(os.path.join(os.path.dirname(__file__),'../..'))
server=subprocess.Popen(['node',root+'/apps/web/node_modules/next/dist/bin/next','start','-p','3000'],cwd=root+'/apps/web',stdout=open('/tmp/dmpilot-local-server.log','w'),stderr=subprocess.STDOUT,env={**os.environ,'NEXTAUTH_SECRET':'local-performance-fixture-only','NEXTAUTH_URL':'http://localhost:3000'})
chrome=None
try:
 for i in range(80):
  try:
   if requests.get('http://localhost:3000').status_code==200:break
  except:pass
  time.sleep(.25)
 cookie=subprocess.check_output(['node','-e',"require('next-auth/jwt').encode({secret:'local-performance-fixture-only',token:{sub:'fixture',user:{id:'fixture',role:'ADMIN'},accessToken:'fixture',accessTokenExpires:Date.now()+1000000}}).then(console.log)"],cwd=root+'/apps/web',text=True).strip()
 chrome=subprocess.Popen(['google-chrome-stable','--headless','--no-sandbox','--disable-gpu','--remote-debugging-port=9228','--remote-allow-origins=*','--user-data-dir='+tempfile.mkdtemp(),'about:blank'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 for i in range(50):
  try:target=next(x for x in requests.get('http://localhost:9228/json').json() if x.get('type')=='page');break
  except:time.sleep(.1)
 ws=websocket.create_connection(target['webSocketDebuggerUrl'],timeout=8);seq=0;events=[];counts=collections.Counter();errors=[]
 fail_metrics=False
 hold_reads=True;held=[];hold_routes=True;routes=[]
 session={'user':{'id':'fixture','name':'Creator fixture','email':'fixture@example.invalid','role':'ADMIN','isVerified':True,'plan':'FREE'},'accessToken':'fixture','expires':'2030-01-01T00:00:00Z'}
 account={'id':'fixture-account','instagramId':'fixture','username':'fixture_creator','displayName':'Fixture creator','isConnected':True,'followersCount':20,'mediaCount':1}
 signed_plan='FREE';fail_flags=False;hold_flags=True;held=[];writes=[]
 session['user']['role']='CREATOR'
 flagkeys=['COMMENT_TO_DM','KEYWORD_TO_DM','WELCOME_DM','STORY_REPLY_TO_DM','SHARE_TO_DM','COMMENT_REPLY','VOICE_CREATE','FOLLOW_CHECK_GATE','REPLY_DESK','WEBHOOK_LOGS','ANALYTICS_ADVANCED','MULTI_ACCOUNT']
 restricted={'WELCOME_DM','VOICE_CREATE','FOLLOW_CHECK_GATE','REPLY_DESK','WEBHOOK_LOGS','ANALYTICS_ADVANCED'}
 def fulfill(m):
  global seq
  p=m['params'];url=p['request']['url'];path=url.split('localhost:4000')[-1].split('?')[0]
  if ':4000' in url and p['request']['method'] not in ['GET','OPTIONS']:writes.append(path)
  if path=='/billing/flags' and hold_flags:held.append(m);return
  if p['request']['method']=='GET':counts[path if ':4000' in url else '/api/auth/session']+=1
  if '/api/auth/session' in url:data=session
  else:
   data=[]
   if path=='/billing/flags':data=[{'key':k,'enabled':signed_plan=='PRO' or k not in restricted} for k in flagkeys]
   if path=='/instagram':data=[account]
   if path=='/instagram/reply-desk':data=[{'id':i,'text':text,'username':'audience_'+i,'createdAt':date,'isReplied':replied,'account':{'username':'fixture_creator'},'category':'GENERAL','suggestedReply':'DO NOT USE OLD SUGGESTION'} for i,text,date,replied in [('replied','Already answered question','2026-11-04T02:00:00Z',True),('new','Can you explain the link for beginners?','2026-11-04T01:00:00Z',False),('old','Where can I learn more?','2026-11-03T01:00:00Z',False)]]
   if path=='/analytics/summary':data={'totalComments':1,'totalDmsSent':1,'successRate':100,'activeCampaigns':1,'failedDms':0}
   data={'success':True,'data':data}
  seq+=1;ws.send(json.dumps({'id':seq,'method':'Fetch.fulfillRequest','params':{'requestId':p['requestId'],'responseCode':503 if fail_flags and path=='/billing/flags' else 200,'responseHeaders':[{'name':'Content-Type','value':'application/json'},{'name':'Access-Control-Allow-Origin','value':'http://localhost:3000'},{'name':'Access-Control-Allow-Credentials','value':'true'},{'name':'Access-Control-Allow-Headers','value':'*'}],'body':base64.b64encode(json.dumps(data).encode()).decode()}}))
 def cmd(method,params={}):
  global seq
  seq+=1;ident=seq;ws.send(json.dumps({'id':ident,'method':method,'params':params}))
  while True:
   m=json.loads(ws.recv())
   if m.get('method')=='Fetch.requestPaused':fulfill(m)
   if m.get('method')=='Runtime.consoleAPICalled': print('CONSOLE',str(m['params'])[:500],flush=True)
   if m.get('method')=='Runtime.exceptionThrown':errors.append(m['params']['exceptionDetails'].get('text'))
   if m.get('id')==ident:
    if 'error' in m: print('CDPERROR',method,m,flush=True)
    return m.get('result',{})
 def pump(seconds=.2):
  end=time.monotonic()+seconds
  while time.monotonic()<end:
   cmd('Runtime.evaluate',{'expression':'document.readyState'});time.sleep(.1)
 def evaluate(expr):return cmd('Runtime.evaluate',{'expression':expr,'returnByValue':True}).get('result',{}).get('value')
 def waittext(text):
  for i in range(30):
   if evaluate('document.body.innerText.includes('+json.dumps(text)+')'):return
   pump(.1)
  print(evaluate('JSON.stringify({url:location.href,text:document.body.textContent.slice(0,2200),resources:performance.getEntriesByType("resource").map(x=>({url:x.name,d:x.duration}))})')); print(counts); print(errors); raise Exception('missing '+text)
 signed_plan='PRO';hold_flags=False
 cmd('Network.enable');cmd('Runtime.enable');cmd('Page.enable')
 cmd('Network.setCookie',{'name':'next-auth.session-token','value':cookie,'domain':'localhost','path':'/'})
 cmd('Fetch.enable',{'patterns':[{'urlPattern':'http://localhost:4000/*'},{'urlPattern':'http://localhost:3000/api/auth/session*'}]})
 cmd('Emulation.setDeviceMetricsOverride',{'width':1280,'height':1000,'deviceScaleFactor':1,'mobile':False})
 cmd('Page.navigate',{'url':'http://localhost:3000/reply-desk'});waittext('AUDIENCE COMMENTS');pump(.8)
 txt=evaluate('document.body.innerText')
 assert txt.index('Where can I learn')<txt.index('Can you explain')<txt.index('Already answered')
 assert 'Intent:' not in txt and 'Price & Rates' not in txt and 'DO NOT USE' not in txt
 assert evaluate("[...document.querySelectorAll('input[placeholder=\"Write your reply...\"]')].every(x=>x.value==='')")
 open('/downloads/dmpilot-replydesk-desktop.png','wb').write(base64.b64decode(cmd('Page.captureScreenshot',{'format':'png'})['data']))
 cmd('Emulation.setDeviceMetricsOverride',{'width':390,'height':950,'deviceScaleFactor':1,'mobile':True});pump(.3)
 open('/downloads/dmpilot-replydesk-mobile.png','wb').write(base64.b64decode(cmd('Page.captureScreenshot',{'format':'png'})['data']))
 assert evaluate('document.documentElement.scrollWidth<=innerWidth')
 assert not writes and not errors,(writes,errors)
 print('PASS general audience UI,unreplied first,oldest within groups,blank reply/no fake suggestion,desktop/mobile no overflow,no writes')
finally:
 if chrome:chrome.terminate();chrome.wait()
 server.terminate();server.wait()
