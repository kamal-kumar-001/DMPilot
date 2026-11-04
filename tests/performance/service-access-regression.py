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
 notification_mode='data';fail_write=False;
 signed_plan='FREE';fail_flags=False;hold_flags=True;held=[];writes=[]
 session['user']['role']='ADMIN';session['user']['plan']='PRO'
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
   if path=='/notifications':data=[] if notification_mode=='empty' else [{'id':'n1','title':'Instagram connection needs attention','message':'Messages could not be delivered. Reconnect the account and review Delivery Logs.','type':'ERROR','isRead':False,'createdAt':'2026-11-04T01:00:00Z'},{'id':'n2','title':'Payment confirmed','message':'Your Pro plan is active. Receipt available in Billing.','type':'SUCCESS','isRead':True,'createdAt':'2026-11-03T01:00:00Z'}]
   if path=='/admin/service-access':data=[{'userId':'synthetic-creator','plan':'PRO','periodEnd':'2026-12-04T02:00:00Z','grant':{'grantId':'synthetic-grant','orderId':'synthetic-order','state':'PROVISIONAL'}}]
   if path=='/billing/plans':data=[{'key':'FREE','name':'Free','priceMonthly':0,'priceYearly':0,'accountLimit':1,'campaignLimit':10,'keywordLimit':10,'dmLimitMonthly':100}]
   if path=='/billing/subscription':data={'plan':'PRO','status':'ACTIVE','accessSource':'EMAIL_OBSERVED','bankVerified':False,'expiresAt':'2026-12-04T02:00:00Z'}
   if path=='/billing/usage':data={'usage':[{'metric':'max_accounts','used':1,'limit':1,'unlimited':False,'percent':100}]}
   if path=='/billing/invoices':data=[{'id':i,'status':status,'amount':1180,'currency':'INR','plan':'PRO','cycle':'MONTHLY','createdAt':'2026-11-04T02:00:00Z','paymentId':'sample-reference'} for i,status in [('pending','PENDING'),('paid','PAID')]]
   if path=='/billing/invoices/paid/receipt':data={'id':'paid','status':'PAID','amount':1180,'currency':'INR','plan':'PRO','cycle':'MONTHLY','createdAt':'2026-11-04T02:00:00Z','paymentId':'sample-reference','user':{'name':'Sample Creator','email':'creator@example.invalid'}}
   if path=='/instagram':data=[account]
   if path=='/instagram/reply-desk':data=[{'id':i,'text':text,'username':'audience_'+i,'createdAt':date,'isReplied':replied,'account':{'username':'fixture_creator'},'category':'GENERAL','suggestedReply':'DO NOT USE OLD SUGGESTION'} for i,text,date,replied in [('replied','Already answered question','2026-11-04T02:00:00Z',True),('new','Can you explain the link for beginners?','2026-11-04T01:00:00Z',False),('old','Where can I learn more?','2026-11-03T01:00:00Z',False)]]
   if path=='/analytics/summary':data={'totalComments':1,'totalDmsSent':1,'successRate':100,'activeCampaigns':1,'failedDms':0}
   data={'success':True,'data':data}
  seq+=1;ws.send(json.dumps({'id':seq,'method':'Fetch.fulfillRequest','params':{'requestId':p['requestId'],'responseCode':503 if (notification_mode=='error' and path=='/notifications') or (fail_write and p['request']['method']!='GET' and ':4000' in url) else 200,'responseHeaders':[{'name':'Content-Type','value':'application/json'},{'name':'Access-Control-Allow-Origin','value':'http://localhost:3000'},{'name':'Access-Control-Allow-Credentials','value':'true'},{'name':'Access-Control-Allow-Headers','value':'*'},{'name':'Access-Control-Allow-Methods','value':'GET,POST,PATCH,DELETE,OPTIONS'}],'body':base64.b64encode(json.dumps(data).encode()).decode()}}))
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
  print(evaluate('JSON.stringify({url:location.href,text:document.body.innerText.slice(0,9000),resources:performance.getEntriesByType("resource").map(x=>({url:x.name,d:x.duration}))})')); print(counts); print(errors); raise Exception('missing '+text)
 signed_plan='FREE';hold_flags=False
 cmd('Network.enable');cmd('Runtime.enable');cmd('Page.enable')
 cmd('Network.setCookie',{'name':'next-auth.session-token','value':cookie,'domain':'localhost','path':'/'})
 cmd('Fetch.enable',{'patterns':[{'urlPattern':'http://localhost:4000/*'},{'urlPattern':'http://localhost:3000/api/auth/session*'}]})
 cmd('Emulation.setDeviceMetricsOverride',{'width':1280,'height':1000,'deviceScaleFactor':1,'mobile':False})
 cmd('Browser.setDownloadBehavior',{'behavior':'allow','downloadPath':'/downloads/receipt-fixture'})
 cmd('Page.navigate',{'url':'http://localhost:3000/settings'});waittext('Billing & Plan');pump(.8)
 evaluate('[...document.querySelectorAll("button")].find(x=>x.textContent.includes("Billing & Plan")).click()');pump(.8);waittext('Awaiting payment');pump(.4)
 waittext('not bank-verified')
 shot=cmd('Page.captureScreenshot',{'format':'png'})['data'];open('/downloads/dmpilot-service-billing-desktop.png','wb').write(base64.b64decode(shot))
 cmd('Page.navigate',{'url':'http://localhost:3000/admin'});waittext('Service Access');pump(.2)
 evaluate('[...document.querySelectorAll("button")].find(x=>x.textContent.includes("Service Access")).click()');waittext('synthetic-order')
 shot=cmd('Page.captureScreenshot',{'format':'png'})['data'];open('/downloads/dmpilot-service-admin-desktop.png','wb').write(base64.b64decode(shot))
 cmd('Emulation.setDeviceMetricsOverride',{'width':390,'height':844,'deviceScaleFactor':1,'mobile':True});pump(.3)
 assert evaluate('document.documentElement.scrollWidth<=390')
 shot=cmd('Page.captureScreenshot',{'format':'png'})['data'];open('/downloads/dmpilot-service-admin-mobile.png','wb').write(base64.b64decode(shot))
 assert not writes
 print('PASS service evidence labels/admin grant/mobile containment/no writes',counts,errors)
 assert not errors
finally:
 if chrome:chrome.terminate();chrome.wait(timeout=5)
 server.terminate();server.wait(timeout=5)
