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
 def fulfill(m):
  global seq
  if '/analytics?' in m['params']['request']['url']:
   if hold_routes:routes.append(m);return
   seq+=1;ws.send(json.dumps({'id':seq,'method':'Fetch.continueRequest','params':{'requestId':m['params']['requestId']}}));return
  if hold_reads and ':4000' in m['params']['request']['url']:
   held.append(m);return
  p=m['params'];url=p['request']['url'];path=url.split('localhost:4000')[-1].split('?')[0];
  if p['request']['method']=='GET': counts[path if ':4000' in url else '/api/auth/session']+=1
  if '/api/auth/session' in url:data=session
  else:
   data=[]
   if path=='/instagram':data=[account]
   elif path=='/analytics/summary':data={'totalComments':12,'totalDmsSent':10,'successRate':90,'activeCampaigns':1,'failedDms':1}
   elif path=='/analytics/rates':data={'sent':10,'failed':1,'pending':0,'successRate':90,'failureRate':10}
   elif path=='/analytics/followers':data={'currentFollowers':20,'followersGrowth30d':0,'followersGrowthPercent30d':0,'dailyHistory':[]}
   if path.startswith('/admin/creators'):data={'data':[],'total':0}
   if path=='/admin/stats':data={}
   data={'success':True,'data':data}
  seq+=1;ws.send(json.dumps({'id':seq,'method':'Fetch.fulfillRequest','params':{'requestId':p['requestId'],'responseCode':503 if fail_metrics and path.startswith('/analytics/') else 200,'responseHeaders':[{'name':'Content-Type','value':'application/json'},{'name':'Access-Control-Allow-Origin','value':'http://localhost:3000'},{'name':'Access-Control-Allow-Credentials','value':'true'},{'name':'Access-Control-Allow-Headers','value':'*'}],'body':base64.b64encode(json.dumps(data).encode()).decode()}}))
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
 cmd('Network.enable');cmd('Runtime.enable');cmd('Page.enable')
 print('browser ready',flush=True);cmd('Network.setCookie',{'name':'next-auth.session-token','value':cookie,'domain':'localhost','path':'/'})
 cmd('Fetch.enable',{'patterns':[{'urlPattern':'http://localhost:4000/*'},{'urlPattern':'http://localhost:3000/api/auth/session*'},{'urlPattern':'http://localhost:3000/analytics?*'}]})
 cmd('Emulation.setDeviceMetricsOverride',{'width':1280,'height':900,'deviceScaleFactor':1,'mobile':False})
 cmd('Page.navigate',{'url':'http://localhost:3000/dashboard'});waittext('Refresh Metrics');pump(.2)
 result={}
 result['structureBeforeData']=evaluate("['TOTAL AUTOMATED REPLIES','Refresh Metrics','Linked Channels'].every(x=>document.body.innerText.includes(x))")
 assert result['structureBeforeData']
 result['noFakeLive']=evaluate("!document.body.innerText.includes('+live')")
 shot=cmd('Page.captureScreenshot',{'format':'png'})['data'];open('/downloads/dmpilot-slow-dashboard-desktop.png','wb').write(base64.b64decode(shot))
 hold_reads=False
 for m in held:fulfill(m)
 held.clear();waittext('fixture_creator');pump(.3)
 evaluate("window.shellRef=document.querySelector('header');window.sideRef=document.querySelector('aside');window.documentMarker=123")
 # Slow network makes the content-only transition observable, separate from business-data latency.
 cmd('Network.emulateNetworkConditions',{'offline':False,'latency':1200,'downloadThroughput':1000000,'uploadThroughput':1000000})
 evaluate("window.navStart=performance.now();[...document.querySelectorAll('aside a')].find(x=>x.getAttribute('href')==='/analytics').click()")
 pump(.08)
 result['immediateFeedback']=evaluate("({ms:performance.now()-window.navStart,loader:document.body.innerText.includes('Loading content...'),selection:[...document.querySelectorAll('aside a')].find(x=>x.getAttribute('href')==='/analytics').className.includes('bg-emerald'),sameHeader:window.shellRef===document.querySelector('header'),sameSidebar:window.sideRef===document.querySelector('aside')})")
 shot=cmd('Page.captureScreenshot',{'format':'png'})['data'];open('/downloads/dmpilot-content-transition.png','wb').write(base64.b64decode(shot))
 hold_routes=False
 for m in routes:fulfill(m)
 routes.clear();pump(3);waittext('Analytics');pump(.5)
 result['clientNav']=evaluate("window.documentMarker===123 && location.pathname==='/analytics'")
 cmd('Network.emulateNetworkConditions',{'offline':False,'latency':0,'downloadThroughput':-1,'uploadThroughput':-1})
 cmd('Page.navigate',{'url':'http://localhost:3000/admin#creators'});waittext('Creators');pump(.7)
 result['adminDeepLink']=evaluate("location.hash==='#creators' && document.querySelector('h1').textContent.trim()==='Creators'")
 evaluate("[...document.querySelectorAll('aside button')].find(x=>x.textContent.includes('Billing Plans')).click()")
 pump(.3);result['adminSelect']=evaluate("location.hash==='#plans' && document.querySelector('h1').textContent.trim()==='Billing Plans'")
 cmd('Page.reload');waittext('Billing Plans');pump(.4)
 result['adminReload']=evaluate("document.querySelector('h1').textContent.trim()==='Billing Plans'")
 evaluate("[...document.querySelectorAll('aside button')].find(x=>x.textContent.includes('Creators')).click()")
 pump(.3);evaluate('history.back()');pump(.3)
 result['adminBack']=evaluate("location.hash==='#plans' && document.querySelector('h1').textContent.trim()==='Billing Plans'")
 evaluate('history.forward()');pump(.3)
 result['adminForward']=evaluate("location.hash==='#creators' && document.querySelector('h1').textContent.trim()==='Creators'")
 cmd('Emulation.setDeviceMetricsOverride',{'width':390,'height':844,'deviceScaleFactor':1,'mobile':True});pump(.3)
 shot=cmd('Page.captureScreenshot',{'format':'png'})['data'];open('/downloads/dmpilot-admin-mobile-ux.png','wb').write(base64.b64decode(shot))
 cmd('Page.navigate',{'url':'http://localhost:3000/admin#not-a-tab'});waittext('Manage Dashboard');pump(.6)
 result['unknownSafe']=evaluate("document.querySelector('h1').textContent.trim()==='Dashboard'")
 session['user']['role']='CREATOR'
 cmd('Page.navigate',{'url':'http://localhost:3000/admin#creators'});cmd('Page.reload');pump(1)
 result['nonAdminDenied']=evaluate("!document.body.innerText.includes('Search by email') && !document.querySelector('h1')?.textContent.includes('Creators')")
 session['user']['role']='ADMIN'
 cmd('Emulation.setDeviceMetricsOverride',{'width':390,'height':844,'deviceScaleFactor':1,'mobile':True})
 hold_reads=True
 cmd('Page.navigate',{'url':'http://localhost:3000/dashboard'});waittext('Refresh Metrics');pump(.2)
 shot=cmd('Page.captureScreenshot',{'format':'png'})['data'];open('/downloads/dmpilot-slow-dashboard-mobile.png','wb').write(base64.b64decode(shot))
 hold_reads=False
 for m in held:fulfill(m)
 held.clear();pump(.5)
 result['mobileNoOverflow']=evaluate('document.documentElement.scrollWidth<=innerWidth')
 result['runtimeErrors']=errors
 print(json.dumps(result,indent=2));assert all(v for k,v in result.items() if isinstance(v,bool))

finally:
 if chrome:chrome.terminate();chrome.wait()
 server.terminate();server.wait()
