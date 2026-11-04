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
 held=[];hold_session=False;signed_in=False
 def fulfill(m):
  global seq
  p=m['params']
  if '/api/auth/session' in p['request']['url'] and hold_session:
   held.append(m);return
  data=(session if signed_in else {}) if '/api/auth/session' in p['request']['url'] else {'success':True,'data':[]}
  seq+=1;ws.send(json.dumps({'id':seq,'method':'Fetch.fulfillRequest','params':{'requestId':p['requestId'],'responseCode':200,'responseHeaders':[{'name':'Content-Type','value':'application/json'},{'name':'Access-Control-Allow-Origin','value':'*'}],'body':base64.b64encode(json.dumps(data).encode()).decode()}}))
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
 cmd('Fetch.enable',{'patterns':[{'urlPattern':'http://localhost:4000/*'},{'urlPattern':'http://localhost:3000/api/auth/session*'}]})
 cmd('Emulation.setDeviceMetricsOverride',{'width':390,'height':844,'deviceScaleFactor':1,'mobile':True})
 # Dedicated manifest entry is a server decision, before client JS.
 r=requests.get('http://localhost:3000/app',allow_redirects=False);print(r.status_code,r.headers.get('Location'),r.text[:150]);assert r.status_code==307 and r.headers['Location'].endswith('/login')
 r=requests.get('http://localhost:3000/app',cookies={'next-auth.session-token':cookie},allow_redirects=False);print(r.status_code,r.headers.get('Location'),r.text[:150]);assert r.status_code==307 and r.headers['Location'].endswith('/dashboard')
 assert 'no-store' in r.headers.get('Cache-Control','')
 print('PASS server307 valid session dashboard / no session login, private no-store')
 cmd('Page.navigate',{'url':'http://localhost:3000/'});waittext('Start Free Today');pump(.3)
 assert evaluate("location.pathname==='/'")
 # Simulate standalone runtime, not a viewport-based inference.
 cmd('Page.addScriptToEvaluateOnNewDocument',{'source':"const original=window.matchMedia.bind(window);window.matchMedia=(q)=>q==='(display-mode: standalone)'?{matches:true,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}}:original(q);"})
 hold_session=True
 cmd('Page.navigate',{'url':'http://localhost:3000/'});waittext('Opening DMPilot...');pump(.4)
 assert evaluate("location.pathname==='/' && !document.body.innerText.includes('Get Started Free')")
 open('/downloads/dmpilot-pwa-held-session.png','wb').write(base64.b64decode(cmd('Page.captureScreenshot',{'format':'png'})['data']))
 hold_session=False
 for m in held:fulfill(m)
 held.clear();pump(.8);waittext('Welcome back to DMPilot')
 assert evaluate("location.pathname==='/login'")
 print('PASS standalone old-root loading waits/no landing flash,then signed-out login')
 signed_in=True
 cmd('Network.setCookie',{'name':'next-auth.session-token','value':cookie,'domain':'localhost','path':'/'})
 cmd('Page.navigate',{'url':'http://localhost:3000/'});waittext('Refresh Metrics');pump(.3)
 assert evaluate("location.pathname==='/dashboard'")
 print('PASS standalone signed-in root dashboard')
 cmd('Page.navigate',{'url':'http://localhost:3000/about'});waittext('About');pump(.3)
 assert evaluate("location.pathname==='/about'")
 print('PASS standalone explicit about deep link preserved')
 assert not errors,errors
finally:
 if chrome:chrome.terminate();chrome.wait()
 server.terminate();server.wait()
