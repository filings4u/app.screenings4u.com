(()=>{'use strict';
window.NONDOTAuth={requireAuth:()=>window.DOTAuth.requireAuth()};
window.NONDOTShell={render:(state)=>{window.DOTShell.render(state);const mount=document.getElementById('dotPageMount');if(mount)mount.id='ndPageMount';return mount;}};
window.NONDOTApi={proposals:async(action,data={})=>{
 const client=window.dotSupabase,config=window.DOT_PORTAL_CONFIG;
 const {data:sessionData,error}=await client.auth.getSession();
 if(error||!sessionData?.session?.access_token)throw Error('Workforce sign in required.');
 const r=await fetch(config.supabaseUrl+'/functions/v1/nondot-proposal-management',{method:'POST',headers:{'content-type':'application/json','apikey':config.supabaseAnonKey,'authorization':'Bearer '+sessionData.session.access_token},body:JSON.stringify({action,...data})});
 const body=await r.json().catch(()=>({}));
 if(!r.ok||body.error)throw Error(body.error||'Proposal request failed');
 return body;
}};
})();