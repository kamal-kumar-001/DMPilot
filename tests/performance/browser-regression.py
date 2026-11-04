import subprocess,time,requests,websocket,json,base64,os,tempfile,collections
from pathlib import Path
root=str(Path(__file__).resolve().parents[2])
server=subprocess.Popen(['node',root+'/apps/web/node_modules/next/dist/bin/next','start','-p','3000'],cwd=root+'/apps/web',stdout=open('/tmp/dmpilot-local-server.log','w'),stderr=subprocess.STDOUT,env={**os.environ,'NEXTAUTH_SECRET':'local-performance-fixture-only','NEXTAUTH_URL':'http://localhost:3000'})
chrome=None
try:
 for i in range(80):
  try:
   if requests.get('http://localhost:3000').status_code==200:break
  except:pass
  time.sleep(.25)
 cookie=subprocess.check_output(['node','-e',"require('next-auth/jwt').encode({secret:'local-performance-fixture-only',token:{sub:'fixture',user:{id:'fixture',role:'CREATOR'},accessToken:'fixture',accessTokenExpires:Date.now()+1000000}}).then(console.log)"],cwd=root+'/apps/web',text=True).strip()
 chrome=subprocess.Popen(['google-chrome-stable','--headless','--no-sandbox','--disable-gpu','--remote-debugging-port=9228','--remote-allow-origins=*','--user-data-dir='+tempfile.mkdtemp(),'about:blank'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 for i in range(50):
  try:target=next(x for x in requests.get('http://localhost:9228/json').json() if x.get('type')=='page');break
  except:time.sleep(.1)
 ws=websocket.create_connection(target['webSocketDebuggerUrl'],timeout=8);seq=0;events=[];counts=collections.Counter();errors=[]
 fail_metrics=False
 session={'user':{'id':'fixture','name':'Creator fixture','email':'fixture@example.invalid','role':'CREATOR','isVerified':True,'plan':'FREE'},'accessToken':'fixture','expires':'2030-01-01T00:00:00Z'}
 account={'id':'fixture-account','instagramId':'fixture','username':'fixture_creator','displayName':'Fixture creator','isConnected':True,'followersCount':20,'mediaCount':1}
 def fulfill(m):
  global seq
  p=m['params'];url=p['request']['url'];path=url.split('localhost:4000')[-1].split('?')[0];
  if p['request']['method']=='GET': counts[path if ':4000' in url else '/api/auth/session']+=1
  if '/api/auth/session' in url:data=session
  else:
   data=[]
   if path=='/instagram':data=[account]
   elif path=='/analytics/summary':data={'totalComments':12,'totalDmsSent':10,'successRate':90,'activeCampaigns':1,'failedDms':1}
   elif path=='/analytics/rates':data={'sent':10,'failed':1,'pending':0,'successRate':90,'failureRate':10}
   elif path=='/analytics/followers':data={'currentFollowers':20,'followersGrowth30d':0,'followersGrowthPercent30d':0,'dailyHistory':[]}
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
 cmd('Fetch.enable',{'patterns':[{'urlPattern':'http://localhost:4000/*'},{'urlPattern':'http://localhost:3000/api/auth/session*'}]})
 cmd('Emulation.setDeviceMetricsOverride',{'width':1280,'height':900,'deviceScaleFactor':1,'mobile':False})
 cmd('Page.navigate',{'url':'http://localhost:3000/dashboard'}); print('navigated',flush=True);waittext('Linked Channels');pump(.8)
 result={'initial':dict(counts)}; counts.clear()
 evaluate("[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='Refresh Metrics').click()")
 waittext('Metrics refreshed.');pump(.3)
 result['refreshCalls']=dict(counts)
 assert all(counts[x]==1 for x in ['/analytics/summary','/analytics/chart','/analytics/followers','/analytics/activity'])
 fail_metrics=True
 evaluate("[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='Refresh Metrics').click()")
 waittext('Could not refresh metrics. Please try again.');pump(.3)
 result['refreshErrorReported']=True;fail_metrics=False
 evaluate("window.clientNavMarker=42;[...document.querySelectorAll('a')].find(x=>x.getAttribute('href')==='/pricing').click()")
 waittext('Go to Dashboard');pump(.3)
 result['dashboardPricingClientNav']=evaluate('window.clientNavMarker===42')
 evaluate("[...document.querySelectorAll('nav a')].find(x=>x.getAttribute('href')==='/about').click()")
 pump(.5);result['pricingAboutClientNav']=evaluate('window.clientNavMarker===42 && location.pathname==="/about"')
 evaluate("[...document.querySelectorAll('a')].find(x=>x.getAttribute('href')==='/dashboard').click()")
 waittext('Linked Channels');pump(.3)
 for width in [1280,390]:
  cmd('Emulation.setDeviceMetricsOverride',{'width':width,'height':900,'deviceScaleFactor':1,'mobile':width<600});pump(.3)
  shot=cmd('Page.captureScreenshot',{'format':'png'})['data'];open('/tmp/dmpilot-after-'+str(width)+'.png','wb').write(base64.b64decode(shot))
 result['overflow']=evaluate('document.documentElement.scrollWidth > window.innerWidth')
 result['runtimeErrors']=errors
 open('/tmp/dmpilot-new-results.json','w').write(json.dumps(result,indent=2));print(json.dumps(result,indent=2))
finally:
 if chrome:chrome.terminate();chrome.wait()
 server.terminate();server.wait()
