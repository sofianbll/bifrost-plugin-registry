#!/usr/bin/env python3
"""Explicit live smoke against YOUR Bifrost. No inference unless --allow-inference.
Environment: BIFROST_URL ending in /v1, BIFROST_VIRTUAL_KEY,
EXPECTED_MODEL_IDS_JSON (JSON array). Never prints credentials or prompts.
No redirects: do not forward credentials to another server.
"""
import argparse,json,os,sys,urllib.request,urllib.error,urllib.parse
class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self,*args,**kwargs): return None

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--allow-inference',action='store_true')
    p.add_argument('--model',help='Exposed model for the optional chat smoke')
    args=p.parse_args()
    base=os.environ.get('BIFROST_URL','').rstrip('/')
    key=os.environ.get('BIFROST_VIRTUAL_KEY','')
    expected=json.loads(os.environ.get('EXPECTED_MODEL_IDS_JSON','null'))
    u=urllib.parse.urlparse(base)
    if u.scheme not in ('http','https') or not u.netloc or u.username or u.query or u.fragment:
        p.error('Set BIFROST_URL to an explicit trusted gateway base URL, e.g. http://127.0.0.1:8080/v1')
    if u.scheme=='http' and u.hostname not in ('localhost','127.0.0.1','::1'):
        p.error('Use HTTPS or a loopback SSH tunnel for a remote gateway')
    if not key.startswith('sk-bf-') or not isinstance(expected,list) or not all(isinstance(x,str) for x in expected):
        p.error('Set BIFROST_VIRTUAL_KEY and EXPECTED_MODEL_IDS_JSON explicitly')
    opener=urllib.request.build_opener(NoRedirect())
    checks=[]
    def request(path,token=None,body=None):
        headers={'Accept':'application/json'}
        if token: headers['Authorization']='Bearer '+token
        data=None
        if body is not None: headers['Content-Type']='application/json';data=json.dumps(body).encode()
        req=urllib.request.Request(base+path,headers=headers,data=data)
        try:
            with opener.open(req,timeout=45) as r: return r.status,r.read(32*1024*1024)
        except urllib.error.HTTPError as e: return e.code,e.read(1024*1024)
    status,_=request('/models')
    checks.append({'check':'models_without_key_rejected','pass':status in (401,403),'http_status':status})
    status,_=request('/models','sk-bf-intentionally-unbound-test-token')
    checks.append({'check':'unbound_key_rejected','pass':status in (401,403),'http_status':status})
    status,raw=request('/models',key)
    good=False;ids=[]
    if status==200:
        data=json.loads(raw);entries=data.get('data');good=isinstance(entries,list) and data.get('object')=='list'
        if good:
            ids=[x.get('id') for x in entries]
            good=sorted(ids)==sorted(expected) and len(ids)==len(set(ids)) and all(set(x).issubset({'id','object','created','owned_by','shutdown_date'}) and x.get('object')=='model' for x in entries)
    checks.append({'check':'exact_minimal_model_catalogue','pass':good,'http_status':status,'observed_ids':ids})
    if args.allow_inference:
        if not args.model or args.model not in expected: p.error('--model must be an expected exposed model')
        # This is the only paid/upstream request made by this script.
        status,raw=request('/chat/completions',key,{'model':args.model,'messages':[{'role':'user','content':'Reply with OK.'}],'max_tokens':32,'stream':False})
        ok=False
        if status==200:
            data=json.loads(raw);ok=isinstance(data.get('choices'),list) and len(data['choices'])>0
        checks.append({'check':'explicit_chat_inference','pass':ok,'http_status':status})
    print(json.dumps({'checks':checks,'inference_requested':args.allow_inference,'all_passed':all(c['pass'] for c in checks)},indent=2))
    return 0 if all(c['pass'] for c in checks) else 1
if __name__=='__main__':
    try: sys.exit(main())
    except (OSError,ValueError,TypeError) as e: print(type(e).__name__+': live test failed; inspect gateway locally',file=sys.stderr);sys.exit(1)
